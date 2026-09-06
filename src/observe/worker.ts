import {
  describeValue,
  newEvent,
  type ObservedEvent,
  type Report,
} from './types';

export type WorkerDecision = 'pass' | 'drop';
export type WorkerInterceptor = (data: unknown) => WorkerDecision;

interface WorkerScope {
  Worker?: typeof Worker;
  SharedWorker?: typeof SharedWorker;
  MessagePort?: typeof MessagePort;
}

const INSTALLED = new WeakSet<object>();

export function observeWorkers(
  scope: WorkerScope,
  report: Report,
  frameUrl?: string,
  interceptor?: WorkerInterceptor,
): () => void {
  if (INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const undo: Array<() => void> = [];

  const safely = (build: () => ObservedEvent, raw?: unknown): void => {
    try {
      report(build(), raw);
    } catch {
      // Observation must never affect the page.
    }
  };

  const wrapConstructor = (
    key: 'Worker' | 'SharedWorker',
    kind: 'worker.create' | 'sharedworker.create',
  ): void => {
    let Original: typeof Worker | typeof SharedWorker | undefined;
    try {
      Original = scope[key];
    } catch {
      return;
    }
    if (typeof Original !== 'function') {
      return;
    }
    const Wrapped = new Proxy(Original, {
      construct(target, args: [string | URL, ...unknown[]], newTarget) {
        safely(() => newEvent(kind, String(args[0]), frameUrl));
        return Reflect.construct(target, args, newTarget);
      },
    });
    (scope as Record<string, unknown>)[key] = Wrapped;
    undo.push(() => {
      (scope as Record<string, unknown>)[key] = Original;
    });
  };

  wrapConstructor('Worker', 'worker.create');
  wrapConstructor('SharedWorker', 'sharedworker.create');

  let WorkerClass: typeof Worker | undefined;
  try {
    WorkerClass = scope.Worker;
  } catch {
    WorkerClass = undefined;
  }
  if (
    typeof WorkerClass === 'function' &&
    WorkerClass.prototype &&
    typeof WorkerClass.prototype.postMessage === 'function'
  ) {
    const originalWorkerPost = WorkerClass.prototype.postMessage;
    function patchedWorkerPost(this: Worker, data: unknown, ...rest: unknown[]): void {
      if (interceptor && interceptor(data) === 'drop') {
        safely(() => {
          const event = newEvent('worker.suppressed', 'worker', frameUrl);
          event.value = describeValue(data);
          return event;
        }, data);
        return;
      }
      return (originalWorkerPost as (...args: unknown[]) => void).call(this, data, ...rest);
    }
    WorkerClass.prototype.postMessage = patchedWorkerPost as typeof originalWorkerPost;
    undo.push(() => {
      WorkerClass.prototype.postMessage = originalWorkerPost;
    });
  }

  let PortClass: typeof MessagePort | undefined;
  try {
    PortClass = scope.MessagePort;
  } catch {
    PortClass = undefined;
  }
  if (typeof PortClass === 'function' && PortClass.prototype && typeof PortClass.prototype.postMessage === 'function') {
    const originalPost = PortClass.prototype.postMessage;
    function patchedPost(this: MessagePort, data: unknown, ...rest: unknown[]): void {
      if (interceptor && interceptor(data) === 'drop') {
        safely(() => {
          const event = newEvent('port.suppressed', 'port', frameUrl);
          event.value = describeValue(data);
          return event;
        }, data);
        return;
      }
      safely(() => {
        const event = newEvent('port.postMessage', 'port', frameUrl);
        event.value = describeValue(data);
        return event;
      }, data);
      return (originalPost as (...args: unknown[]) => void).call(this, data, ...rest);
    }
    PortClass.prototype.postMessage = patchedPost as typeof originalPost;
    undo.push(() => {
      PortClass.prototype.postMessage = originalPost;
    });
  }

  return () => {
    for (const step of undo.reverse()) {
      step();
    }
    undo.length = 0;
    INSTALLED.delete(scope);
  };
}
