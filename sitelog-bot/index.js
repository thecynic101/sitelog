require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Simple in-memory state mapping Telegram User ID -> Active Project ID
// (In a full app, this would be read from a database table)
const activeProjects = new Map();

bot.start((ctx) => {
    ctx.reply(
        "Welcome to SiteLog! 🏗️\n\n" +
        "To get started, you can either:\n" +
        "1. Create a new project: /newproject [Name]\n" +
        "2. Join an existing project: /join [Token]\n\n" +
        "Example: /newproject Ikoyi Mall"
    );
});

bot.command('newproject', async (ctx) => {
    const projectName = ctx.message.text.split(' ').slice(1).join(' ');
    if (!projectName) {
        return ctx.reply("Please provide a project name. Example: /newproject Ikoyi Mall");
    }

    const inviteToken = crypto.randomBytes(3).toString('hex').toUpperCase();

    const { data, error } = await supabase
        .from('projects')
        .insert([{ name: projectName, invite_token: inviteToken, created_by: ctx.from.id }])
        .select()
        .single();

    if (error) {
        console.error(error);
        return ctx.reply("Error creating project. Please try again.");
    }

    // Auto-join the project they just created
    activeProjects.set(ctx.from.id, data.id);

    ctx.reply(
        `✅ Project "${projectName}" created!\n\n` +
        `Your Invite Token is: ${inviteToken}\n\n` +
        `You are now actively logging to this project. Just send a photo, video, or note!`
    );
});

bot.command('join', async (ctx) => {
    const token = ctx.message.text.split(' ')[1];
    
    if (!token) {
        return ctx.reply("Please provide an invite token. Example: /join A1B2C3");
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('invite_token', token.toUpperCase())
        .single();

    if (error || !data) {
        return ctx.reply("❌ Invalid invite token. Please check and try again.");
    }

    // Set their active project
    activeProjects.set(ctx.from.id, data.id);

    ctx.reply(`✅ Successfully joined: "${data.name}"!\n\nYou are now actively logging to this project. Just send a photo, video, or note!`);
});

bot.command('gallery', (ctx) => {
    const userId = ctx.from.id.toString();
    
    // Generate the secure hash using the exact same Bot Token secret as the frontend
    const token = crypto
        .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN)
        .update(userId)
        .digest('hex');

    // Telegram API blocks 'localhost' inside Inline Buttons for security reasons.
    // For local testing, we must send it as plain text. When deployed to Vercel, 
    // we can safely upgrade this to a button.
    const galleryUrl = `http://localhost:3000/api/auth/bot?uid=${userId}&token=${token}`;

    ctx.reply(`Here is your secure link to the SiteLog Dashboard:\n\n${galleryUrl}`);
});

// Helper function to process all media types
async function handleMedia(ctx, type, fileId, caption = '') {
    const projectId = activeProjects.get(ctx.from.id);
    if (!projectId) {
        return ctx.reply("⚠️ Please /join a project or create a /newproject before sending files!");
    }

    const statusMsg = await ctx.reply(`⏳ Uploading ${type} to SiteLog...`);

    try {
        // 1. Get the download URL from Telegram
        const fileUrl = await ctx.telegram.getFileLink(fileId);
        
        // 2. Download the file into memory
        const response = await fetch(fileUrl.href);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Extract extension from the URL
        const extension = fileUrl.href.split('.').pop() || 'file';
        const fileName = `${projectId}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;

        // 3. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('sitelog-media')
            .upload(fileName, buffer, {
                contentType: response.headers.get('content-type') || 'application/octet-stream',
            });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from('sitelog-media')
            .getPublicUrl(fileName);

        // 4. Save metadata to the database
        const { error: dbError } = await supabase
            .from('media_items')
            .insert([{
                project_id: projectId,
                type: type,
                file_url: publicUrl,
                caption: caption || '',
                uploaded_by: ctx.from.id
            }]);

        if (dbError) throw dbError;

        // Edit the "Uploading..." message to "Success"
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} logged successfully!`);
    } catch (error) {
        console.error("Upload error:", error);
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ Failed to save ${type}. Please try again.`);
    }
}

// Media Handlers
bot.on('photo', async (ctx) => {
    // Telegram sends multiple sizes for photos. The last one is the highest resolution.
    const highestResPhoto = ctx.message.photo[ctx.message.photo.length - 1];
    await handleMedia(ctx, 'photo', highestResPhoto.file_id, ctx.message.caption);
});

bot.on('video', async (ctx) => {
    const video = ctx.message.video;
    // 20MB limit check (20 * 1024 * 1024 bytes)
    if (video.file_size > 20971520) {
        return ctx.reply("⚠️ This video is larger than 20MB! Please compress it or send a shorter clip.");
    }
    await handleMedia(ctx, 'video', video.file_id, ctx.message.caption);
});

bot.on('document', async (ctx) => {
    const doc = ctx.message.document;
    // 20MB limit check
    if (doc.file_size > 20971520) {
        return ctx.reply("⚠️ This document is larger than 20MB!");
    }
    await handleMedia(ctx, 'document', doc.file_id, ctx.message.caption);
});

// Text Note Handler
bot.on('text', async (ctx) => {
    // Ignore commands (they are handled above)
    if (ctx.message.text.startsWith('/')) return;

    const projectId = activeProjects.get(ctx.from.id);
    if (!projectId) {
        return ctx.reply("⚠️ Please /join a project or create a /newproject before logging updates!");
    }

    const { error: dbError } = await supabase
        .from('media_items')
        .insert([{
            project_id: projectId,
            type: 'text_note',
            caption: ctx.message.text,
            uploaded_by: ctx.from.id
        }]);

    if (dbError) {
        console.error("Note error:", dbError);
        return ctx.reply("❌ Failed to log note.");
    }

    ctx.reply("📝 Text update logged!");
});

bot.launch().then(() => {
    console.log("🏗️ SiteLog Bot is running with Media Handlers!");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
