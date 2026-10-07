import { documentsApi } from './documentsApi.js';

/** Opens the original PDF in a new tab, jumping to a page (browsers' PDF viewers honor #page=N). */
export async function openDocumentAtPage(documentId, page) {
  const tab = window.open('', '_blank'); // opened synchronously in the click, so popup blockers allow it
  try {
    const url = await documentsApi.fileUrl(documentId);
    const target = page ? `${url}#page=${page}` : url;
    if (tab) tab.location.href = target;
    else window.location.assign(target);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    tab?.close();
    return false;
  }
}
