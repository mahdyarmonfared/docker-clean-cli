# 🐳 DockerClean-CLI

> **Zero-dependency interactive Docker container, image, volume, and build cache cleaner with visual web studio.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Core)-blue)](package.json)
[![Tests](https://img.shields.io/badge/Tests-6%2F6%20Passing-brightgreen)](test/)
[![Port](https://img.shields.io/badge/Web%20Studio-Port%203013-79c0ff)](http://localhost:3013)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 💡 Why DockerClean-CLI?

Running Docker locally silently consumes tens or hundreds of gigabytes of disk space over time. Stopped containers, dangling image layers, unused named volumes, and build cache layers pile up without obvious warnings.

Standard commands like `docker system prune` can feel nuclear or opaque.

**DockerClean-CLI (`dockerclean`)** gives developers and DevOps engineers total visibility and surgical control over disk space reclamation:
- 📊 **Itemized Disk Usage Breakdown**: Calculates exact reclaimable gigabytes across stopped containers, dangling images, unused volume mounts, and Docker build cache.
- ⚡ **Zero External Dependencies**: Pure Node.js standard library core interacting directly with Docker CLI binaries.
- 🌐 **Interactive Visual Web Studio**: Dark-mode dashboard running locally on **port 3013** with checkboxes to select specific assets or category batches for targeted deletion.
- 🧪 **Dry-Run Mode (`--dry-run`)**: Preview estimated disk space savings before executing any deletion.
- 🛡️ **Safe Daemon Fallback**: Includes simulated mock inspection when running in non-Docker or headless environments.

---

## ⚡ Quick Start

Run instantly with `npx`:

```bash
# View disk usage report & reclaimable space
npx docker-clean-cli df

# Preview reclaimable space without deleting
npx docker-clean-cli prune --all --dry-run

# Reclaim all dangling images, stopped containers & build cache
npx docker-clean-cli prune --all

# Launch Visual Web Studio on localhost:3013
npx docker-clean-cli ui
```

Or install globally:

```bash
npm install -g docker-clean-cli
dockerclean --help
```

---

## 🖥️ Visual Web Studio (Port 3013)

Launch the visual dashboard locally with:

```bash
dockerclean ui
# Or with custom port:
dockerclean ui --port 3013
```

Open your browser to `http://localhost:3013` to access:
- **Reclaimable Disk Gauge**: Real-time counter of total gigabytes ready for safe reclamation.
- **Categorized Asset Grid**: Interactive tabs for Containers, Images, Volumes, and Build Cache.
- **Checkbox Asset Selection**: Multi-select specific dangling layers or click "Select All Dangling Items".
- **One-Click Space Reclamation**: Execute background prune operations with real-time toast feedback.

---

## 🛠️ CLI Reference

### 1. `dockerclean df` / `dockerclean list` (Default)
Displays a structured ASCII breakdown table of disk usage across all 4 Docker resource categories.

```bash
dockerclean df
dockerclean df --json   # Machine-readable JSON output
```

### 2. `dockerclean prune` / `dockerclean clean`
Safely reclaims disk space by deleting stopped containers, dangling images, unused volumes, or build cache.

```bash
dockerclean prune --all              # Prune all reclaimable Docker assets
dockerclean prune --containers       # Prune stopped containers only
dockerclean prune --images           # Prune dangling/unused images only
dockerclean prune --volumes          # Prune unused volume mounts only
dockerclean prune --cache            # Prune Docker build cache layers
dockerclean prune --all --dry-run    # Preview space savings without deleting
```

---

## 🔬 Architecture

```text
docker-clean-cli/
├── bin/
│   └── docker-clean-cli.js    # Executable CLI entry binary (dockerclean / docker-clean)
├── src/
│   ├── core/
│   │   ├── docker-client.js   # Native Docker CLI wrapper & simulated daemon fallback
│   │   ├── size-calculator.js # Human-readable byte size parser & reclaimable summary
│   │   └── index.js           # Unified core barrel module
│   ├── cli/
│   │   ├── ansi.js            # Zero-dependency ANSI formatting & ASCII table printer
│   │   └── runner.js          # CLI argument parser & command handler
│   ├── server/
│   │   └── server.js          # HTTP server & REST API on port 3013
│   └── ui/
│       ├── index.html         # Web Studio dark-mode interface
│       ├── style.css          # Devtools aesthetic styling
│       └── app.js             # Client JS application
└── test/
    ├── size-calculator.test.js
    ├── docker-client.test.js
    └── server.test.js         # REST API test suite
```

---

## 📄 License

MIT © [Mahdyar Monfared](https://github.com/mahdyarmonfared)
