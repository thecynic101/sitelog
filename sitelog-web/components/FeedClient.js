'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, Image as ImageIcon, Video, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function FeedClient({ initialItems }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter items based on search term
  const filteredItems = initialItems.filter(item => {
    const term = searchTerm.toLowerCase();
    const captionMatch = item.caption?.toLowerCase().includes(term);
    const projectMatch = item.projects?.name?.toLowerCase().includes(term);
    const typeMatch = item.type?.toLowerCase().includes(term);
    return captionMatch || projectMatch || typeMatch;
  });

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1 className="title">SiteLog</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {filteredItems.length} items logged
        </span>
      </div>

      <div className="search-container">
        <Search className="search-icon" size={16} />
        <input 
          type="text" 
          className="search-bar" 
          placeholder="Search captions, projects, or file types..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-header">
        <div className="col-time">Date & Time</div>
        <div className="col-content">Update</div>
        <div className="col-project">Project</div>
      </div>

      <div>
        {filteredItems.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No logs found.
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = expandedItems.has(item.id);
            const dateStr = isMounted ? format(new Date(item.created_at), 'MMM d, yyyy') : '';
            const timeStr = isMounted ? format(new Date(item.created_at), 'h:mm a') : '';

            return (
              <div key={item.id} className="table-row">
                <div className="col-time">
                  <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{dateStr}</div>
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>{timeStr}</div>
                </div>
                
                <div className="col-content">
                  {item.type === 'text_note' ? (
                    <div>{item.caption}</div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        {item.type === 'photo' && <ImageIcon size={16} color="var(--accent)" />}
                        {item.type === 'video' && <Video size={16} color="var(--accent)" />}
                        {item.type === 'document' && <FileText size={16} color="var(--accent)" />}
                        
                        {item.type === 'photo' && 'Image Uploaded'}
                        {item.type === 'video' && 'Video Uploaded'}
                        {item.type === 'document' && 'Document Uploaded'}
                      </div>
                      
                      {item.caption && (
                        <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                          {item.caption}
                        </div>
                      )}

                      <button onClick={() => toggleExpand(item.id)} className="expand-btn">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide File' : 'View File'}
                      </button>

                      {isExpanded && (
                        <div className="expanded-media">
                          {item.type === 'photo' && <img src={item.file_url} alt={item.caption || 'Site Photo'} />}
                          {item.type === 'video' && <video src={item.file_url} controls />}
                          {item.type === 'document' && (
                            <div style={{ padding: '16px', background: 'var(--bg-hover)' }}>
                              <a href={item.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                Download Document (Opens in new tab)
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-project">
                  <span style={{ 
                    background: 'var(--bg-hover)', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-light)' 
                  }}>
                    {item.projects?.name || 'Unknown'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
