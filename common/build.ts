import { buildCode } from 'bob-ts';
import { execaCommand } from 'execa';
import { mkdir, rm, writeFile } from 'fs/promises';
import pkg from './package.json';

async function main() {
  await rm('dist', {
    force: true,
    recursive: true,
  });

  const tsc = execaCommand('tsc -p tsconfig.build.json', {
    stdio: 'inherit',
  });

  await Promise.allSettled([mkdir('dist')]);

  await Promise.all([
    buildCode({
      clean: true,
      entryPoints: ['src'],
      format: 'cjs',
      outDir: 'dist',
      target: 'node14',
      sourcemap: false,
      rollup: {
        exports: 'named',
      },
    }),
    writeFile(
      'dist/package.json',
      JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          main: 'index.js',
          dependencies: pkg.dependencies,
          license: pkg.license,
        },
        null,
        2,
      ),
    ),
  ]);

  await tsc;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
