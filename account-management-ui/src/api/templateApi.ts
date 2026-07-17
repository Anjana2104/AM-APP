/**
 * templateApi.ts
 *
 * Template management API � handles upload, download, and deletion of templates.
 * Supports: PIW Template, Holiday Calendar, SOW Template, Rate Card Template, and other types.
 * Primary storage: SQLite backend via /api/templates.
 * Fallback: localStorage for offline/serverless mode.
 */

const TEMPLATES_BASE = '/api/templates';

export interface Template {
  id: string;
  type: 'piw_template' | 'holiday_calendar' | 'sow_template' | 'rate_card_template' | 'other';
  file_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  mime_type: string;
  description?: string;
}

interface StoredTemplate extends Template {
  data?: string;
}

type ApiResult<T = undefined> = T extends undefined
  ? { ok: boolean; error?: string }
  : { ok: boolean; data?: T; error?: string };

const isServerAvailable = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const response = await fetch('/api/health', { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const extractErrorMessage = (e: unknown, fallback: string): string => {
  if (e instanceof Error) return e.message || fallback;
  return fallback;
};

// Upload template � uses server SQLite, falls back to localStorage
export const uploadTemplate = async (
  file: File,
  type: string,
  description?: string,
): Promise<ApiResult<Template>> => {
  try {
    if (await isServerAvailable()) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (description) formData.append('description', description);

      const response = await fetch(`${TEMPLATES_BASE}/upload`, { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json() as Template;
        return { ok: true, data };
      }
      const errBody = await response.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: errBody.error || 'Upload failed' };
    }
    return fallbackUploadTemplate(file, type, description);
  } catch (e: unknown) {
    return { ok: false, error: extractErrorMessage(e, 'Upload failed') };
  }
};

// Get all templates � uses server SQLite, falls back to localStorage
export const getTemplates = async (type?: string): Promise<ApiResult<Template[]>> => {
  try {
    if (await isServerAvailable()) {
      const url = type
        ? `${TEMPLATES_BASE}?type=${encodeURIComponent(type)}`
        : TEMPLATES_BASE;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json() as Template[];
        return { ok: true, data };
      }
    }
    // Fallback: localStorage
    const stored = JSON.parse(localStorage.getItem('eam_templates') || '[]') as StoredTemplate[];
    const filtered = type ? stored.filter(t => t.type === type) : stored;
    return { ok: true, data: filtered };
  } catch (e: unknown) {
    return { ok: false, error: extractErrorMessage(e, 'Fetch failed') };
  }
};

// Get single template by ID � uses server SQLite, falls back to localStorage
export const getTemplate = async (templateId: string): Promise<ApiResult<Blob> & { blob?: Blob }> => {
  try {
    if (await isServerAvailable()) {
      const response = await fetch(`${TEMPLATES_BASE}/${encodeURIComponent(templateId)}`);
      if (response.ok) return { ok: true, blob: await response.blob() };
      if (response.status !== 404) return { ok: false, error: 'Failed to download template' };
    }
    return fallbackGetTemplate(templateId);
  } catch (e: unknown) {
    return { ok: false, error: extractErrorMessage(e, 'Get failed') };
  }
};

// Delete template � uses server SQLite, falls back to localStorage
export const deleteTemplate = async (templateId: string): Promise<ApiResult> => {
  try {
    if (await isServerAvailable()) {
      const response = await fetch(`${TEMPLATES_BASE}/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
      if (response.ok) return { ok: true };
      return { ok: false, error: 'Failed to delete from server' };
    }
    // Fallback: localStorage
    const stored = JSON.parse(localStorage.getItem('eam_templates') || '[]') as StoredTemplate[];
    localStorage.setItem('eam_templates', JSON.stringify(stored.filter(t => t.id !== templateId)));
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: extractErrorMessage(e, 'Delete failed') };
  }
};

// Download template by ID (triggers browser download)
export const downloadTemplate = async (templateId: string, fileName: string): Promise<void> => {
  const result = await getTemplate(templateId);
  if (!result.ok || !result.blob) throw new Error(result.error || 'Download failed');
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- Fallback helpers (localStorage for offline mode) ----------------------

const fallbackUploadTemplate = async (
  file: File,
  type: string,
  description?: string,
): Promise<ApiResult<Template>> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('eam_templates') || '[]') as StoredTemplate[];
        const withoutSameType = stored.filter(t => t.type !== type);
        const newTemplate: StoredTemplate = {
          id: `tpl_${Date.now()}`,
          type: type as Template['type'],
          file_name: file.name,
          file_size: file.size,
          uploaded_by: 'local_user',
          uploaded_at: new Date().toISOString(),
          mime_type: file.type,
          description,
          data: reader.result as string,
        };
        withoutSameType.push(newTemplate);
        localStorage.setItem('eam_templates', JSON.stringify(withoutSameType));
        resolve({ ok: true, data: newTemplate });
      } catch (e: unknown) {
        resolve({ ok: false, error: extractErrorMessage(e, 'Failed to save template') });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: 'Failed to read file' });
    reader.readAsDataURL(file);
  });

const fallbackGetTemplate = async (
  templateId: string,
): Promise<ApiResult<Blob> & { blob?: Blob }> => {
  try {
    const stored = JSON.parse(localStorage.getItem('eam_templates') || '[]') as StoredTemplate[];
    const template = stored.find(t => t.id === templateId);
    if (template?.data) {
      const response = await fetch(template.data);
      return { ok: true, blob: await response.blob() };
    }
    return { ok: false, error: 'Template not found' };
  } catch (e: unknown) {
    return { ok: false, error: extractErrorMessage(e, 'Get failed') };
  }
};