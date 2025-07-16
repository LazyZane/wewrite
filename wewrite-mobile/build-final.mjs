import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

try {
  console.log('🚀 Building WeWrite Mobile Final Version...');
  
  const result = await esbuild.build({
    entryPoints: [join(__dirname, 'wewrite-final.ts')],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    target: 'es2018',
    outfile: join(__dirname, 'main.js'),
    minify: isProduction,
    sourcemap: !isProduction,
    metafile: true,
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }
  });

  console.log('✅ Final version build completed successfully!');
  
  if (result.metafile) {
    const outputs = Object.keys(result.metafile.outputs);
    outputs.forEach(output => {
      const size = result.metafile.outputs[output].bytes;
      const sizeKB = (size / 1024).toFixed(1);
      console.log(`📦 ${output.split('/').pop()}  ${sizeKB}kb`);
    });
  }

  console.log('\n🎉 WeWrite Mobile 最终版本构建完成！');
  console.log('📁 文件: main.js');
  console.log('📋 配置: manifest.json');
  console.log('🚀 可以直接使用了！');

} catch (error) {
  console.error('❌ Final version build failed:', error);
  process.exit(1);
}
