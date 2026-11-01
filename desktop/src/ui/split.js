// The draggable divider between two pages. It only reports where the pointer is; the window decides the layout.
const bar = document.getElementById('bar');
bar.addEventListener('pointerdown', (e) => { bar.setPointerCapture(e.pointerId); bar.classList.add('on'); });
bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture(e.pointerId)) splitApi.drag(e.screenX); });
bar.addEventListener('pointerup', (e) => { bar.releasePointerCapture(e.pointerId); bar.classList.remove('on'); });
bar.addEventListener('dblclick', () => splitApi.reset());
