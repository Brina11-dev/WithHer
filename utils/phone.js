function normalizeKenyanPhone(input) {
  if (!input) return null;

  let phone = String(input).trim().replace(/[\s\-()]/g, '');

  if (phone.startsWith('+254')) {

  } else if (phone.startsWith('254')) {
    phone = '+' + phone;
  } else if (phone.startsWith('0')) {
    phone = '+254' + phone.slice(1);
  } else {
    return null;
  }

  return /^\+254[17]\d{8}$/.test(phone) ? phone : null;
}

module.exports = { normalizeKenyanPhone };