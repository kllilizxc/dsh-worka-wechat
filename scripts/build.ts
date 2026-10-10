const result = await Bun.build({entrypoints:['src/index.ts'],outdir:'dist',target:'node',packages:'external'});
if(!result.success) throw new AggregateError(result.logs, 'WeChat plugin build failed');
