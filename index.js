const fs = require('fs-extra');
const pixelmatch = require('pixelmatch');
const looksSame = require('looks-same');
const PNG = require('pngjs').PNG;
const {compare: ssimCie94} = require('playwright-core/lib/image_tools/compare');

const withBenchmark = async (tool, caseName, iterations, func) => {
    performance.mark(`${tool}: ${caseName}/`);
    
    for (let i = 0; i < iterations; i++) {
        await func();
    }

    performance.mark(`/${tool}: ${caseName}`);

    const {duration} = performance.measure(`${tool}: ${caseName}`, `${tool}: ${caseName}/`, `/${tool}: ${caseName}`);

    console.log(`${tool}: ${caseName}`, duration / iterations);
};

const runLooksSameCase = (img1, img2, caseName, iterations) => 
    withBenchmark('looks-same', caseName, iterations, async () => {
        const {equal, diffImage} = await looksSame(img1, img2, {
            ignoreCaret: false,
            ignoreAntialiasing: true,
            tolerance: 2.3,
            createDiffImage: true // Mandatory. New API
        });

        if (!equal) {
            await diffImage.save(`diff/looks-same ${caseName}.png`);
        }
    });

const runPixelmatchCase = (img1, img2, caseName, iterations) =>
    withBenchmark('pixelmatch', caseName, iterations, () => {
        const pngjsImage1 = PNG.sync.read(img1);
        const pngjsImage2 = PNG.sync.read(img2);
        const {width, height} = pngjsImage1;
        const pngjsImageDiff = new PNG({width, height});
        const differentPixels = pixelmatch(
            pngjsImage1.data,
            pngjsImage2.data,
            pngjsImageDiff.data,
            width,
            height,
            {threshold: 0.2}
        );

        if (differentPixels) {
            fs.writeFileSync(`diff/pixelmatch ${caseName}.png`, PNG.sync.write(pngjsImageDiff));
        }
    });

const runSsimCie94Case = (img1, img2, caseName, iterations) =>
    withBenchmark('ssim-cie94', caseName, iterations, () => {
        const pngjsImage1 = PNG.sync.read(img1);
        const pngjsImage2 = PNG.sync.read(img2);
        const {width, height} = pngjsImage1;
        const pngjsImageDiff = new PNG({width, height});
        const differentPixels = ssimCie94(
            pngjsImage1.data,
            pngjsImage2.data,
            pngjsImageDiff.data,
            width,
            height,
            {threshold: 0.2}
        );

        if (differentPixels) {
            fs.writeFileSync(`diff/ssim-cie94 ${caseName}.png`, PNG.sync.write(pngjsImageDiff));
        }
    });

async function bench(imgPathA, imgPathB, caseName) {
    const iterations = 10;
    const img1 = fs.readFileSync(imgPathA);
    const img2 = fs.readFileSync(imgPathB);

    await runLooksSameCase(img1, img2, caseName, iterations);
    await runPixelmatchCase(img1, img2, caseName, iterations);
    await runSsimCie94Case(img1, img2, caseName, iterations);
}

async function main() {
    const fixturesDir = 'fixtures';
    const baseImage = 'base-image';
    const cases = [
        'equal buffers',
        'indistinguishable difference',
        'distinguishable difference',
        'big difference',
        'huge difference',
        'gigantic difference'
    ];

    for (const caseName of cases) {
        const imgPathA = `${fixturesDir}/${baseImage}.png`;
        const imgPathB = `${fixturesDir}/${caseName}.png`;

        await bench(imgPathA, imgPathB, caseName);
    }
}

main();
