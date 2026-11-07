/* Order form: pre-fills the cake from any Order button, validates,
   then shows the WhatsApp message the order would send.
   DEMO MODE: nothing is sent and WhatsApp is not opened.
   To go live, set DEMO = false and put the real number in WHATSAPP_NUMBER. */
(() => {
  // The bakery's WhatsApp number, international format without "+" (sample number)
  const WHATSAPP_NUMBER = '60123456789';
  const DEMO = true;

  const form = document.getElementById('order-form');
  if (!form) return;
  const cake = form.elements.cake;
  const name = form.elements.name;
  const phone = form.elements.phone;
  const note = form.elements.note;
  const status = document.getElementById('order-status');
  const pick = document.getElementById('order-pick');
  const pickImg = document.getElementById('order-pick-img');
  const pickCap = document.getElementById('order-pick-cap');

  /* Show the chosen cake next to the form */
  const showPick = () => {
    const opt = cake.selectedOptions[0];
    if (!opt || !opt.value) { pick.hidden = true; return; }
    pickImg.src = opt.dataset.img;
    pickImg.alt = opt.value;
    pickCap.textContent = `${opt.value}, ${opt.dataset.price}`;
    pick.hidden = false;
    pick.classList.remove('is-new');
    void pick.offsetWidth;            // restart the little pop animation
    pick.classList.add('is-new');
  };

  /* Any link with data-cake that points at #order pre-selects that cake */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="#order"][data-cake]');
    if (!link) return;
    const match = [...cake.options].find((o) => o.value === link.dataset.cake);
    if (match) {
      cake.value = match.value;
      clearError(cake);
      showPick();
    }
  });
  cake.addEventListener('change', () => { clearError(cake); showPick(); });

  /* Validation */
  const errorEl = (field) => document.getElementById(field.getAttribute('aria-describedby'));
  function setError(field, msg) {
    field.setAttribute('aria-invalid', 'true');
    errorEl(field).textContent = msg;
  }
  function clearError(field) {
    field.removeAttribute('aria-invalid');
    errorEl(field).textContent = '';
  }
  [name, phone].forEach((f) => f.addEventListener('input', () => clearError(f)));

  function validate() {
    let first = null;
    const fail = (f, msg) => { setError(f, msg); first = first || f; };
    if (!cake.value) fail(cake, 'Choose a cake.');
    if (!name.value.trim()) fail(name, 'Enter your name.');
    const digits = phone.value.replace(/\D/g, '');
    if (!digits) fail(phone, 'Enter your phone number.');
    else if (digits.length < 9 || digits.length > 15 || /[^\d\s+()-]/.test(phone.value)) {
      fail(phone, 'Enter a phone number like 012-345 6789.');
    }
    if (first) first.focus();
    return !first;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = '';
    if (!validate()) return;

    const lines = [
      'Hi Layer Room, I would like to order a cake.',
      '',
      `Cake: ${cake.value} (${cake.selectedOptions[0].dataset.price})`,
      `Name: ${name.value.trim()}`,
      `Phone: ${phone.value.trim()}`,
    ];
    if (note.value.trim()) lines.push(`Special request: ${note.value.trim()}`);
    const message = lines.join('\n');

    if (DEMO) {
      status.innerHTML = '';
      const head = document.createElement('p');
      head.className = 'order-status-head';
      head.textContent = "This site is a demo, so nothing was sent. Here's the WhatsApp message your order would create:";
      const preview = document.createElement('pre');
      preview.className = 'order-preview';
      preview.textContent = message;
      status.append(head, preview);
      return;
    }

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp in a new tab; keep a link in case the browser blocks it
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();

    status.innerHTML = '';
    status.append('Your order is ready in WhatsApp. Press send there to reach us. ');
    const again = document.createElement('a');
    again.href = url; again.target = '_blank'; again.rel = 'noopener';
    again.textContent = 'Open WhatsApp again';
    status.append(again);
  });
})();
