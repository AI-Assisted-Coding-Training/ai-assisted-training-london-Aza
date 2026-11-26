// Display name validation, per the backend's 1-32 char (post-trim) rule.
const MAX_LENGTH = 32;

export function validateDisplayName(rawName) {
  const trimmedName = (rawName ?? '').trim();

  if (trimmedName.length === 0) {
    return { valid: false, message: 'Enter a display name to join.' };
  }

  if (trimmedName.length > MAX_LENGTH) {
    return { valid: false, message: `Display name must be ${MAX_LENGTH} characters or fewer.` };
  }

  return { valid: true, trimmedName };
}
