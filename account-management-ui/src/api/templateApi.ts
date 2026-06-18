/**
 * templateApi.ts
 * 
 * Template management API — handles upload, download, and deletion of templates
 * Supports: PIW Template, Holiday Calendar, SOW Template, and other configurable types
 * Primary storage: SQLite backend via /api/templates
 * Fallback: localStorage for offline mode
 */

export interface Template {
  id: string;
  type: 'piw_template' | 'holiday_calendar' | 'sow_template' | 'other';
  file_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  mime_type: string;
  description?: string;
}

const isServerAvailable = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
    
    const response = await fetch('http://localhost:3001/api/health', { 
      method: 'GET',
      mode: 'cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};

// Upload template - uses server SQLite
export const uploadTemplate = async (file: File, type: string, description?: string): Promise<{ ok: boolean; data?: Template; error?: string }> => {
  try {
    const serverAvailable = await isServerAvailable();
    
    if (serverAvailable) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        if (description) formData.append('description', description);

        const response = await fetch('http://localhost:3001/api/templates/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Template uploaded to server:', data);
          return { ok: true, data };
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }
      } catch (serverError: any) {
        console.error('Server upload failed:', serverError);
        return { ok: false, error: serverError.message || 'Upload failed' };
      }
    }

    // Fallback: localStorage (offline mode)
    return fallbackUploadTemplate(file, type, description);
  } catch (e: any) {
    console.error('Template upload error:', e);
    return { ok: false, error: e.message || 'Upload failed' };
  }
};

// Get all templates - uses server SQLite
export const getTemplates = async (type?: string): Promise<{ ok: boolean; data?: Template[]; error?: string }> => {
  try {
    const serverAvailable = await isServerAvailable();
    
    if (serverAvailable) {
      try {
        const url = type 
          ? `http://localhost:3001/api/templates?type=${encodeURIComponent(type)}`
          : 'http://localhost:3001/api/templates';
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log('Templates fetched from server:', data);
          return { ok: true, data };
        } else {
          throw new Error('Failed to fetch templates');
        }
      } catch (serverError: any) {
        console.error('Server fetch failed:', serverError);
        // Fall back to localStorage
      }
    }

    // Fallback: localStorage
    const localTemplates = JSON.parse(localStorage.getItem('eam_templates') || '[]') as any[];
    const localFiltered = type ? localTemplates.filter(t => t.type === type) : localTemplates;
    console.log('Templates fetched from localStorage (offline):', localFiltered);
    return { ok: true, data: localFiltered };
  } catch (e: any) {
    console.error('Template fetch error:', e);
    return { ok: false, error: e.message || 'Fetch failed' };
  }
};

// Get single template by ID - uses server SQLite
export const getTemplate = async (templateId: string): Promise<{ ok: boolean; blob?: Blob; error?: string }> => {
  try {
    const serverAvailable = await isServerAvailable();
    
    if (serverAvailable) {
      try {
        const response = await fetch(`http://localhost:3001/api/templates/${encodeURIComponent(templateId)}`);
        if (response.ok) {
          const blob = await response.blob();
          console.log('Template downloaded from server');
          return { ok: true, blob };
        } else if (response.status === 404) {
          console.warn('Template not found on server');
          // Fall back to localStorage
        } else {
          throw new Error('Failed to download template');
        }
      } catch (serverError: any) {
        console.error('Server download failed:', serverError);
        // Fall back to localStorage
      }
    }

    // Fallback: localStorage
    return fallbackGetTemplate(templateId);
  } catch (e: any) {
    console.error('Template get error:', e);
    return { ok: false, error: e.message || 'Get failed' };
  }
};

// Delete template - uses server SQLite
export const deleteTemplate = async (templateId: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const serverAvailable = await isServerAvailable();
    
    if (serverAvailable) {
      try {
        const response = await fetch(`http://localhost:3001/api/templates/${encodeURIComponent(templateId)}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log('Template deleted from server');
          return { ok: true };
        } else {
          throw new Error('Failed to delete from server');
        }
      } catch (serverError: any) {
        console.error('Server delete failed:', serverError);
        // Fall back to localStorage
      }
    }

    // Fallback: localStorage
    const templates = JSON.parse(localStorage.getItem('eam_templates') || '[]') as any[];
    const filtered = templates.filter(t => t.id !== templateId);
    localStorage.setItem('eam_templates', JSON.stringify(filtered));
    console.log('Template deleted from localStorage');
    return { ok: true };
  } catch (e: any) {
    console.error('Template delete error:', e);
    return { ok: false, error: e.message || 'Delete failed' };
  }
};

// Download template by ID (triggers browser download)
export const downloadTemplate = async (templateId: string, fileName: string): Promise<void> => {
  const result = await getTemplate(templateId);
  if (!result.ok || !result.blob) {
    throw new Error(result.error || 'Download failed');
  }

  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────
// FALLBACK FUNCTIONS (localStorage for offline mode)
// ─────────────────────────────────────────────────────────────────

const fallbackUploadTemplate = async (file: File, type: string, description?: string): Promise<{ ok: boolean; data?: Template; error?: string }> => {
  try {
    const reader = new FileReader();
    
    return new Promise((resolve) => {
      reader.onload = () => {
        try {
          const templates = JSON.parse(localStorage.getItem('eam_templates') || '[]') as any[];
          const filtered = templates.filter(t => t.type !== type);
          
          const newTemplate = {
            id: `tpl_${Date.now()}`,
            type: type,
            file_name: file.name,
            file_size: file.size,
            uploaded_by: 'local_user',
            uploaded_at: new Date().toISOString(),
            mime_type: file.type,
            description,
            data: reader.result
          };
          
          filtered.push(newTemplate);
          localStorage.setItem('eam_templates', JSON.stringify(filtered));
          console.log('Template saved to localStorage (offline)');
          resolve({ ok: true, data: newTemplate });
        } catch (e: any) {
          console.error('Offline upload error:', e);
          resolve({ ok: false, error: e.message || 'Failed to save template' });
        }
      };
      
      reader.onerror = () => {
        resolve({ ok: false, error: 'Failed to read file' });
      };
      
      reader.readAsDataURL(file);
    });
  } catch (e: any) {
    console.error('Fallback upload error:', e);
    return { ok: false, error: e.message || 'Upload failed' };
  }
};

const fallbackGetTemplate = async (templateId: string): Promise<{ ok: boolean; blob?: Blob; error?: string }> => {
  try {
    const templates = JSON.parse(localStorage.getItem('eam_templates') || '[]') as any[];
    const template = templates.find(t => t.id === templateId);
    
    if (template && template.data) {
      console.log('Template found in localStorage (offline)');
      try {
        const response = await fetch(template.data);
        const blob = await response.blob();
        return { ok: true, blob };
      } catch (e) {
        console.error('Error converting base64 to blob:', e);
        return { ok: false, error: 'Failed to process template data' };
      }
    }
    
    return { ok: false, error: 'Template not found' };
  } catch (e: any) {
    console.error('Fallback get error:', e);
    return { ok: false, error: e.message || 'Get failed' };
  }
};

