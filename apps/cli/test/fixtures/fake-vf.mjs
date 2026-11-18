// Stands in for the vf CLI in job tests: prints pino-style lines, then exits 0, or 1 when told to fail.
const fail = process.argv.includes("--fail");
const log = (o) => console.log(JSON.stringify({ level: 30, ...o }));
log({ stage: "script.write", msg: "start" });
log({ stage: "video.render", msg: "start" });
log({ stage: "video.render", progress: 42, msg: "rendering" });
if (fail) {
  console.error("provider-failed: render crashed");
  process.exit(1);
}
log({ stage: "video.render", msg: "done" });
