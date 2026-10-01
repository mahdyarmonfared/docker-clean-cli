/**
 * CLI command runner for DockerClean-CLI.
 */

const {
  getDiskUsage,
  removeContainers,
  removeImages,
  removeVolumes,
  pruneBuildCache,
  pruneSystem
} = require('../core');

const { chalk, renderTable } = require('./ansi');

function parseArgs(args) {
  const parsed = {
    command: null,
    options: {
      containers: false,
      images: false,
      volumes: false,
      cache: false,
      all: false,
      force: false,
      dryRun: false,
      port: 3013,
      json: false,
      help: false,
      version: false
    }
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.options.version = true;
    } else if (arg === '--json') {
      parsed.options.json = true;
    } else if (arg === '--dry-run') {
      parsed.options.dryRun = true;
    } else if (arg === '-f' || arg === '--force') {
      parsed.options.force = true;
    } else if (arg === '--containers' || arg === '-c') {
      parsed.options.containers = true;
    } else if (arg === '--images' || arg === '-i') {
      parsed.options.images = true;
    } else if (arg === '--volumes' || arg === '-v') {
      parsed.options.volumes = true;
    } else if (arg === '--cache') {
      parsed.options.cache = true;
    } else if (arg === '--all' || arg === '-a') {
      parsed.options.all = true;
    } else if (arg === '--ui') {
      parsed.command = 'ui';
    } else if (arg === '--port' && args[i + 1]) {
      parsed.options.port = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    parsed.command = positional[0];
  }

  return parsed;
}

function printHelp() {
  console.log(`
${chalk.bold(chalk.cyan('🐳 DockerClean-CLI'))} ${chalk.dim('v1.0.0')}
${chalk.dim('Zero-dependency interactive Docker container, image, volume & cache cleaner.')}

${chalk.bold('USAGE:')}
  ${chalk.green('dockerclean')} ${chalk.yellow('[command]')} ${chalk.cyan('[options]')}

${chalk.bold('COMMANDS:')}
  ${chalk.yellow('df, list')}          Display disk usage & reclaimable space breakdown (default)
  ${chalk.yellow('prune, clean')}      Safely delete stopped containers, dangling images & cache
  ${chalk.yellow('ui, studio')}        Launch interactive Web Studio on localhost:3013
  ${chalk.yellow('help')}              Show this help guide

${chalk.bold('OPTIONS:')}
  ${chalk.cyan('-c, --containers')}   Prune stopped containers
  ${chalk.cyan('-i, --images')}       Prune dangling/unused images
  ${chalk.cyan('-v, --volumes')}      Prune unused volume mounts
  ${chalk.cyan('--cache')}            Prune Docker build cache
  ${chalk.cyan('-a, --all')}          Prune ALL reclaimable Docker assets
  ${chalk.cyan('--dry-run')}         Calculate reclaimable disk space without deleting
  ${chalk.cyan('--json')}            Output machine-readable JSON
  ${chalk.cyan('--port <number>')}   Port for Web Studio (default: 3013)
  ${chalk.cyan('-h, --help')}        Display help message

${chalk.bold('EXAMPLES:')}
  $ dockerclean df
  $ dockerclean prune --all --dry-run
  $ dockerclean prune -c -i
  $ dockerclean ui --port 3013
`);
}

function runDf(options) {
  const usage = getDiskUsage();

  if (options.json) {
    console.log(JSON.stringify(usage, null, 2));
    return 0;
  }

  console.log(`\n${chalk.bold(chalk.cyan('🐳 DockerClean Disk Usage Report'))} ${usage.isMock ? chalk.yellow('(SIMULATED DAEMON)') : chalk.green('(DOCKER DAEMON LIVE)')}\n`);

  console.log(`Total Reclaimable Disk Space: ${chalk.bold(chalk.green(usage.summary.totalReclaimableFormatted))}\n`);

  // Summary Table
  const headers = ['Category', 'Total Items', 'Reclaimable Items', 'Estimated Space Savings'];
  const rows = [
    [
      chalk.bold('Containers'),
      usage.containers.length,
      usage.containers.filter(c => c.stopped).length + ' (Stopped)',
      chalk.green(usage.summary.containerReclaimableFormatted)
    ],
    [
      chalk.bold('Images'),
      usage.images.length,
      usage.images.filter(i => i.dangling || !i.inUse).length + ' (Dangling/Unused)',
      chalk.green(usage.summary.imageReclaimableFormatted)
    ],
    [
      chalk.bold('Volumes'),
      usage.volumes.length,
      usage.volumes.filter(v => !v.inUse).length + ' (Unused)',
      chalk.green(usage.summary.volumeReclaimableFormatted)
    ],
    [
      chalk.bold('Build Cache'),
      usage.buildCache.length,
      usage.buildCache.filter(b => b.reclaimable).length + ' (Reclaimable)',
      chalk.green(usage.summary.cacheReclaimableFormatted)
    ]
  ];

  console.log(renderTable(headers, rows));
  console.log(`\n${chalk.dim('Tip: Run "dockerclean prune --all" to reclaim disk space, or "dockerclean ui" for visual selection.')}\n`);

  return 0;
}

function runPrune(options) {
  const usage = getDiskUsage();

  console.log(`\n${chalk.bold(chalk.cyan('🐳 DockerClean Reclamation'))}`);

  if (options.dryRun) {
    console.log(chalk.yellow('\n[DRY RUN] Simulating cleanup calculations:'));
    console.log(`  Reclaimable Space: ${chalk.bold(chalk.green(usage.summary.totalReclaimableFormatted))}`);
    console.log(`  Stopped Containers: ${usage.containers.filter(c => c.stopped).length}`);
    console.log(`  Dangling Images: ${usage.images.filter(i => i.dangling).length}`);
    console.log(`  Unused Volumes: ${usage.volumes.filter(v => !v.inUse).length}\n`);
    return 0;
  }

  if (usage.isMock) {
    console.log(chalk.yellow('\n⚠ Docker daemon is not active. Cleanup operations simulated successfully.'));
    console.log(`✔ Reclaimed ${chalk.bold(chalk.green(usage.summary.totalReclaimableFormatted))} of disk space.\n`);
    return 0;
  }

  const pruneAll = options.all || (!options.containers && !options.images && !options.volumes && !options.cache);

  if (pruneAll || options.containers) {
    const stoppedContainerIds = usage.containers.filter(c => c.stopped).map(c => c.id);
    if (stoppedContainerIds.length > 0) {
      removeContainers(stoppedContainerIds, options.force);
      console.log(chalk.green(`✔ Removed ${stoppedContainerIds.length} stopped container(s)`));
    }
  }

  if (pruneAll || options.images) {
    const danglingImageIds = usage.images.filter(i => i.dangling).map(i => i.id);
    if (danglingImageIds.length > 0) {
      removeImages(danglingImageIds, options.force);
      console.log(chalk.green(`✔ Removed ${danglingImageIds.length} dangling image(s)`));
    }
  }

  if (pruneAll || options.volumes) {
    const unusedVolumeNames = usage.volumes.filter(v => !v.inUse).map(v => v.name);
    if (unusedVolumeNames.length > 0) {
      removeVolumes(unusedVolumeNames);
      console.log(chalk.green(`✔ Removed ${unusedVolumeNames.length} unused volume(s)`));
    }
  }

  if (pruneAll || options.cache) {
    pruneBuildCache();
    console.log(chalk.green(`✔ Pruned Docker build cache`));
  }

  console.log(chalk.bold(chalk.green('\n✔ Disk space cleanup complete!\n')));
  return 0;
}

function runUi(options) {
  const { startServer } = require('../server/server');
  startServer(options.port);
}

function execute(args = process.argv.slice(2)) {
  const { command, options } = parseArgs(args);

  if (options.version) {
    const pkg = require('../../package.json');
    console.log(`docker-clean-cli v${pkg.version}`);
    return 0;
  }

  if (options.help || command === 'help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'df':
    case 'list':
    case undefined:
    case null:
      return runDf(options);

    case 'prune':
    case 'clean':
      return runPrune(options);

    case 'ui':
    case 'studio':
      runUi(options);
      return 0;

    default:
      console.error(chalk.red(`✖ Unknown command: ${command}`));
      printHelp();
      return 1;
  }
}

module.exports = {
  execute,
  parseArgs
};
