import makePublishManifestPkg from '@pnpm/exportable-manifest';
import type { ProjectManifest } from '@pnpm/types';
import { buildCode } from 'bob-ts';
import { execaCommand } from 'execa';
import { copy, ensureDir } from 'fs-extra';
import { readFile, rm, writeFile } from 'fs/promises';
import { extname } from 'path';
import pkg from './package.json';

const makePublishManifest = getDefault(makePublishManifestPkg);

async function main() {
  await rm('dist', {
    force: true,
    recursive: true,
  });

  const tsc = execaCommand('tsc -p tsconfig.build.json', {
    stdio: 'inherit',
  });

  await ensureDir('dist/bin');

  await Promise.all([
    buildCode({
      clean: false,
      entryPoints: ['src', 'deploy', 'typechain/factories', 'typechain/index.ts', 'hardhat.config.ts'],
      format: 'cjs',
      outDir: 'dist',
      target: 'node14',
      sourcemap: false,
      rollup: {
        exports: 'auto',
      },
      external(source) {
        return source.endsWith('.json');
      },
    }),
    copy('src/artifacts', 'dist/src/artifacts'),
    copy('src/deployments', 'dist/src/deployments'),
    copy('contracts', 'dist/contracts'),
    copy('../LICENSE', 'dist/LICENSE'),
    copy('typechain', 'dist/typechain', {
      filter(file) {
        if (extname(file) === '') return true;

        return file.endsWith('.d.ts');
      },
    }),
    writeFile(
      'dist/package.json',
      JSON.stringify(
        await makePublishManifest('.', {
          name: pkg.name,
          version: pkg.version,
          main: 'src/index.js',
          types: 'src/index.d.ts',
          dependencies: pkg.dependencies,
          license: pkg.license,
          bin: pkg.bin,
          repository: pkg.repository,
        } as ProjectManifest),
        null,
        2
      )
    ),
    readFile('./bin/hardhat.cjs', 'utf-8').then((content) =>
      writeFile('./dist/bin/hardhat.cjs', content.replace('../dist/hardhat.config.js', '../hardhat.config.js'), 'utf-8')
    ),
  ]);

  await readFile('./dist/hardhat.config.js', 'utf-8').then((content) =>
    writeFile(
      './dist/hardhat.config.js',
      content
        .replace("require('@typechain/hardhat');", "// require('@typechain/hardhat');")
        .replace('src/deployments', 'src/deployments_2'),
      'utf-8'
    )
  ),
    await tsc;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function getDefault<T>(v: T | { default?: T }) {
  return (('default' in v ? v.default : v) || v) as T;
}
