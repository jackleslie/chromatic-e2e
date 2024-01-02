import type { elementNode } from 'rrweb-snapshot';
import CDP, { Version } from 'chrome-remote-interface';
import { writeTestResult } from '../write-archive';
import type { ChromaticStorybookParameters } from '../types';
import type { ResourceArchive } from '../resource-archive';
import { Watcher } from '../resource-archive';

interface ArchiveParams {
  testTitle: string;
  domSnapshots: elementNode[];
  resourceArchive: ResourceArchive;
  chromaticStorybookParams: ChromaticStorybookParameters;
  pageUrl: string;
}

const doArchive = async ({
  testTitle,
  domSnapshots,
  resourceArchive,
  chromaticStorybookParams,
  pageUrl,
}: ArchiveParams) => {
  const bufferedArchiveList = Object.entries(resourceArchive).map(([key, value]) => {
    return [
      key,
      {
        ...value,
        // we can't use Buffer in the browser (when we collect the responses)
        // so we go through one by one here and bufferize them
        // @ts-expect-error will fix when Cypress has its own package
        body: Buffer.from(value.body, 'utf8'),
      },
    ];
  });

  const allSnapshots = Object.fromEntries(
    domSnapshots.map((item, index) => [`Snapshot #${index + 1}`, Buffer.from(JSON.stringify(item))])
  );

  await writeTestResult(
    {
      title: testTitle,
      // this will store it at ./cypress/downloads (the last directory doesn't matter)
      // TODO: change so we don't have to do this trickery
      outputDir: './cypress/downloads/some',
      pageUrl,
    },
    allSnapshots,
    Object.fromEntries(bufferedArchiveList),
    // @ts-expect-error will fix when Cypress has its own package
    { ...chromaticStorybookParams, viewport: { width: 500, height: 500 } }
  );
};

export const archiveCypress = async (params: ArchiveParams): Promise<null> => {
  await doArchive({ ...params, resourceArchive: watcher.archive });

  return null;
};

let watcher: Watcher = null;

let host = '';
let port = '';

// @ts-expect-error fix when reuse code
export const doCDP = async () => {
  try {
    // @ts-expect-error asdf
    const { webSocketDebuggerUrl } = await Version({
      host,
      port,
    });

    const cdp = await CDP({
      target: webSocketDebuggerUrl,
    });

    if (!watcher) {
      // @ts-expect-error asdf
      watcher = new Watcher(cdp);
      await watcher.watch();
    }
  } catch (err) {
    console.log('err', err);
  }

  return null;
};

export const finishCDP = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // @ts-expect-error asdf
      watcher.idle();
      // write archive to disk
      console.log('ARCHIVE OF POC', watcher.archive);
      // write archive to disk
      resolve(null);
    }, 2000);
  });
};

// @ts-expect-error type launchOptions
export const onBeforeBrowserLaunch = (browser = {}, launchOptions) => {
  console.log('BEFORE LAUNCH');
  // @ts-expect-error type launchOptions
  const hostArg = launchOptions.args.find((arg) => arg.startsWith('--remote-debugging-address='));
  host = hostArg ? hostArg.split('=')[1] : '127.0.0.1';

  // @ts-expect-error type launchOptions
  const portArg = launchOptions.args.find((arg) => arg.startsWith('--remote-debugging-port='));
  const entry = process.env.ELECTRON_EXTRA_LAUNCH_ARGS.split(' ').find((item) =>
    item.startsWith('--remote-debugging-port')
  );
  const altPort = entry.split('=')[1];
  port = portArg ? portArg.split('=')[1] : altPort;

  // some backup but it doesn't seem very good...
  // url = `ws://${host}:${port}/devtools/browser`

  return launchOptions;
};
