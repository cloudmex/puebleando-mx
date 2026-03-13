try {
  const binding = require('@tailwindcss/oxide-win32-x64-msvc');
  console.log('✅ Success: @tailwindcss/oxide-win32-x64-msvc is loadable');
} catch (e) {
  console.error('❌ Error loading MSVC binding:', e.message);
  console.error('Stack:', e.stack);
}

try {
  const path = require('path');
  const bindingPath = path.resolve('node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node');
  const binding = require(bindingPath);
  console.log('✅ Success: Native .node file is loadable via absolute path');
} catch (e) {
  console.error('❌ Error loading .node file directly:', e.message);
}
