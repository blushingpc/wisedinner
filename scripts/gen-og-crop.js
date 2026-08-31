// one-off: crop A2 into the 800×630 left panel of the composed OG image (DESIGN-AUDIT §13 A6).
// run: node scripts/gen-og-crop.js — output is committed; never part of build or deploy.
import sharp from "sharp";

sharp("public/img/A2.jpg")
  .metadata()
  .then(async (m) => {
    const cw = Math.round(m.height * (800 / 630));
    await sharp("public/img/A2.jpg")
      .extract({ left: 220, top: 0, width: cw, height: m.height })
      .resize(800, 630)
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile("app/og/a2-og.jpg");
    console.log("written app/og/a2-og.jpg from", m.width + "x" + m.height);
  });
