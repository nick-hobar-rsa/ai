# Development Environments

> Setup, toolchain, and build instructions for each target platform.

---

## Environment 1: macOS (M3, arm64)

**Purpose**: Primary development workstation. Unit testing. Debugging with mock HAL.

### Prerequisites

```bash
# Xcode Command Line Tools (provides clang, make, etc.)
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# CMake
brew install cmake

# CTest comes with CMake

# Git (usually pre-installed, but brew version is newer)
brew install git
```

### Build

```bash
cd /home/z/my-project
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug \
         -DPLATFORM=macos_arm64 \
         -DBUILD_TESTS=ON
cmake --build . -j$(sysctl -n hw.ncpu)
ctest --output-on-failure
```

### Platform Layer

macOS uses **mock/stub** HAL implementations. Real hardware access (USB-serial, etc.) is possible but not the primary path. Mock implementations simulate hardware responses for unit and integration testing.

### Notes
- Apple Clang 15+ (via Xcode 15+)
- No real-time guarantees
- Good debugging experience (LLDB, Instruments)
- Can connect to real hardware via USB adapters for integration testing

---

## Environment 2: Ubuntu 24.04 (x86_64)

**Purpose**: CI/CD runner. Integration testing. Cross-compilation host for Yocto aarch64.

### Prerequisites

```bash
sudo apt update
sudo apt install -y build-essential cmake git \
    gcc-aarch64-linux-gnu g++-aarch64-linux-gnu \
    qemu-user-static  # For testing aarch64 binaries on x86

# Optional: clang/clang-tidy for static analysis
sudo apt install -y clang clang-tidy cppcheck

# Optional: Yocto dependencies (if building on this machine)
sudo apt install -y gawk wget git diffstat unzip texinfo gcc build-essential \
    chrpath cpio python3 python3-pip python3-git python3-jinja2 \
    libegl-dev mesa-dev libgles2-mesa-dev locales \
    python3-subunit xmlto
```

### Native Build (x86_64 with mock HAL)

```bash
cd /home/z/my-project
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug \
         -DPLATFORM=ubuntu_x86_64 \
         -DBUILD_TESTS=ON
cmake --build . -j$(nproc)
ctest --output-on-failure
```

### Cross-Compile (aarch64, for Yocto target)

```bash
mkdir -p build-aarch64 && cd build-aarch64
cmake .. -DCMAKE_TOOLCHAIN_FILE=../config/cmake/aarch64-linux-gnu-toolchain.cmake \
         -DPLATFORM=yocto_aarch64 \
         -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
```

### Static Analysis

```bash
# From build directory with clang compiler
cmake .. -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++
cmake --build . --target clang-tidy  # If configured in CMakeLists

# Standalone cppcheck
cppcheck --enable=all --std=c11 --project=cmake-build-dir/compile_commands.json \
         --suppress=missingInclude --output-file=tests/static/cppcheck-report.txt
```

### Notes
- GCC 13 (default in 24.04)
- CI-friendly (headless, scriptable)
- Cross-compile toolchain: `gcc-aarch64-linux-gnu`
- QEMU user-mode can run aarch64 binaries for smoke tests (no HW needed)

---

## Environment 3: Yocto Linux (aarch64, Embedded Target)

**Purpose**: Final deployment target. Real hardware access.

### Yocto Layer Structure

```
config/yocto/
├── meta-<project>/
│   ├── conf/
│   │   └── layer.conf
│   ├── recipes-<project>/
│   │   └── <project>/
│   │       └── <project>_git.bb
│   └── classes/
│       └── <project>-test.bbclass      (optional)
```

### Recipe Example (Skeleton)

```bitbake
# config/yocto/meta-<project>/recipes-<project>/<project>/<project>_git.bb
SUMMARY = "<Project Name> - Hardware Interface Software"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://LICENSE;md5=<hash>"

DEPENDS = "cmake-native"

SRC_URI = "git://<repo-url>;protocol=<protocol>;branch=${SRCBRANCH}"
SRCBRANCH = "main"
SRCREV = "${AUTOREV}"

S = "${WORKDIR}/git"

inherit cmake

EXTRA_OECMAKE += " \
    -DPLATFORM=yocto_aarch64 \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_TESTS=OFF \
"

# If tests should run on target:
# EXTRA_OECMAKE += "-DBUILD_TESTS=ON"
# inherit cmake_qt5  # or ptest, depending on test framework

do_install:append() {
    # Install any config files, systemd units, etc.
    :
}

FILES:${PN} += " \
    /usr/bin/* \
    /etc/<project>/* \
"
```

### Building the Yocto Image

```bash
# On the Ubuntu host (or any Yocto-compatible host)
source oe-init-build-env

# In conf/bblayers.conf, add meta-<project> path
# In conf/local.conf, add: IMAGE_INSTALL:append = " <project>"

bitbake <image-name>
```

### Flashing / Deployment

```bash
# Specific commands depend on target board (e.g., Raspberry Pi, custom board)
# Placeholder — fill in during M5
# scripts/deploy.sh <image-file> <target-device>
```

### Notes
- Yocto Kirkstone (4.0) or later recommended
- Toolchain provided by Yocto (don't use host cross-compile for final builds)
- `oe-qmake` or `cmake` class handles cross-compilation automatically
- Target may have limited resources — optimize for size where needed
- Consider `DISTRO_FEATURES:remove = "ptest"` if not running tests on target

---

## CMake Toolchain File Reference

```
config/cmake/
├── macos-arm64-toolchain.cmake      (optional — usually auto-detected)
├── ubuntu-x86_64-toolchain.cmake   (optional — usually auto-detected)
└── aarch64-linux-gnu-toolchain.cmake  (for Ubuntu host cross-compile)
```

### aarch64-linux-gnu-toolchain.cmake (Skeleton)

```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

---

## Environment Compatibility Matrix

| Feature | macOS M3 | Ubuntu x86 | Yocto aarch64 |
|---------|----------|------------|---------------|
| Native build | ✅ | ✅ | ✅ (via bitbake) |
| Unit tests | ✅ | ✅ | ⚠️ (if resources allow) |
| Integration tests (mock) | ✅ | ✅ | ❌ |
| HIL tests (real HW) | ⚠️ (USB adapter) | ⚠️ (USB adapter) | ✅ |
| Static analysis | ✅ | ✅ | ❌ (host-side) |
| Cross-compile to aarch64 | ❌ | ✅ | N/A |
| Debugging | ✅ (LLDB) | ✅ (GDB) | ✅ (GDB remote) |
| Real-time constraints | ❌ | ❌ | ⚠️ (depends on kernel config) |