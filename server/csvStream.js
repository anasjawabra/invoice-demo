// Yield between chunks even when the socket can accept more data. Honour
// backpressure and stop the iterator immediately when the client disconnects.
export function streamCsv(res, iterator) {
  return new Promise((resolve, reject) => {
    let stopped = false; let scheduled;
    const finish = (error) => {
      if (stopped) return;
      stopped = true;
      if (scheduled) clearImmediate(scheduled);
      res.off('close', close); res.off('error', fail); res.off('drain', schedule);
      iterator.return?.();
      if (error) reject(error); else resolve();
    };
    const close = () => finish();
    const fail = (error) => finish(error);
    const schedule = () => { if (!stopped) scheduled = setImmediate(pump); };
    const pump = () => {
      if (stopped || res.destroyed) return finish();
      try {
        const { value, done } = iterator.next();
        if (done) { res.end(); finish(); return; }
        if (res.write(value)) schedule(); else res.once('drain', schedule);
      } catch (error) { finish(error); }
    };
    res.once('close', close); res.once('error', fail); schedule();
  });
}
