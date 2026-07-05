const sharp = require('sharp')
const fs = require('fs')

const svgBuffer = fs.readFileSync('./public/logo.svg')

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-icon.png', size: 180 },
]

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(`./public/${name}`)
    console.log(`Generated ${name}`)
  }

  // favicon.ico용 32x32 PNG도 생성 (favicon 변환은 별도 처리)
  await sharp(svgBuffer).resize(32, 32).png().toFile('./public/favicon-32.png')
  console.log('Generated favicon-32.png')
}

generate()
