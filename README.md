# Layer Room — cake website

A static bakery site: a hero that turns three 3D cakes on a wheel as you scroll, a carousel of cakes, visit details, and an order form that sends orders to WhatsApp.

Live site: https://zoeworks678.github.io/layer-room/

> Sample content to replace before launch: the bakery name "Layer Room", cake prices, the address/phone/email in the Visit section (`index.html`), and the WhatsApp number at the top of `js/order.js`.

## Run it locally

The page uses JavaScript modules, so opening `index.html` directly from disk won't work. Serve the folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(or `npx serve .`, or the VS Code "Live Server" extension)

## Publish on GitHub Pages

1. Push this folder to a GitHub repository (the files at the repo root).
2. In the repo go to **Settings → Pages**, set **Source** to "Deploy from a branch", choose `main` and `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or so.

Everything uses relative paths and the libraries are bundled in `vendor/`, so no build step is needed.

## Structure

```
index.html          page markup and cake copy
css/style.css       layout, type and colours
js/hero.js          Three.js scene + GSAP ScrollTrigger wheel
models/             compressed cake models (meshopt + WebP, ~4.5 MB total)
vendor/             three.js r187, GSAP 3 + ScrollTrigger
```

## Things you'll likely tweak

- **Cake names, descriptions, prices:** `index.html`, inside each `.cake-copy`.
- **Background and text colour per cake:** the `CAKES` list at the top of `js/hero.js`.
- **Wheel feel:** `STEP` (angle between cakes), `SPIN_PER_STEP` (how much each cake turns), and the `snap` settings in the ScrollTrigger block.
- **Bakery name:** "Layer Room" is a placeholder in `index.html`.

## Re-compressing models

If you replace a cake model, compress it the same way:

```bash
npm i -g @gltf-transform/cli
gltf-transform optimize input.glb models/name.glb --compress meshopt --texture-compress webp --texture-size 1024
```
