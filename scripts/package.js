import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const applications = await packager({
  dir: root, out: path.join(root, 'dist'), name: 'Salesforce Pipeline Intelligence',
  appBundleId: 'com.omrigalor.pipelineintelligence', appVersion: '1.0.0',
  icon: path.join(root, 'assets/PipelineIntelligence.icns'),
  platform: 'darwin', arch: 'arm64', overwrite: true, asar: true,
  ignore: [/^\/test($|\/)/, /^\/scripts($|\/)/, /^\/reports($|\/)/, /^\/app\/views\.html$/, /^\/assets\/PipelineIntelligence\.iconset($|\/)/]
});
for (const dir of applications) {
  const bundle = path.join(dir, 'Salesforce Pipeline Intelligence.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
  console.log(bundle);
}
