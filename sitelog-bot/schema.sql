-- Create Projects Table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  created_by BIGINT NOT NULL, -- Telegram User ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Media Items Table
CREATE TABLE media_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'photo', 'video', 'document', 'text_note'
  file_url TEXT,
  caption TEXT,
  uploaded_by BIGINT NOT NULL, -- Telegram User ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (we will bypass with service_role in the bot, but good practice for later web gallery)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Note: Don't forget to manually create a Storage Bucket named 'sitelog-media' in the Supabase Dashboard!
