/**
 * Copy text to the clipboard.
 * @param {string} value
 * @returns {Promise<boolean>}
 */
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = value
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
