{
  description = "Development shell for qh-screenshare on NixOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          inherit (pkgs) lib;

          node = pkgs.nodejs;

          devTools = with pkgs; [
            node
            pnpm
            git
            procps
            curl
            jq
            pkg-config
            python3
            gcc
            gnumake
          ];

          electronRuntimeLibs = with pkgs; [
            alsa-lib
            at-spi2-atk
            at-spi2-core
            atk
            cairo
            cups
            dbus
            expat
            gdk-pixbuf
            glib
            gtk3
            libdrm
            libgbm
            libnotify
            libpulseaudio
            libsecret
            libxkbcommon
            mesa
            nspr
            nss
            pango
            pipewire
            stdenv.cc.cc
            udev
            wayland
            xdg-desktop-portal
            xdg-desktop-portal-gtk
            xdg-utils
            libice
            libsm
            libx11
            libxscrnsaver
            libxcomposite
            libxcursor
            libxdamage
            libxext
            libxfixes
            libxi
            libxrandr
            libxrender
            libxtst
            libxcb
            libxshmfence
          ];

          runtimeLibraryPath = lib.makeLibraryPath electronRuntimeLibs;

          commonShellHook = ''
            export LD_LIBRARY_PATH="${runtimeLibraryPath}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
            export PATH="${pkgs.procps}/bin:$PATH"

            export ELECTRON_OZONE_PLATFORM_HINT="''${ELECTRON_OZONE_PLATFORM_HINT:-auto}"
            export NIXOS_OZONE_WL="''${NIXOS_OZONE_WL:-1}"

            echo "qh-screenshare Nix dev shell"
            echo "Node: $(node --version)"
            echo "pnpm: $(pnpm --version)"
            echo
            echo "Common commands:"
            echo "  pnpm install --frozen-lockfile"
            echo "  pnpm typecheck && pnpm lint && pnpm test && pnpm build"
            echo "  pnpm dev:server"
            echo "  pnpm dev:viewer"
            echo "  pnpm dev:host"
            echo
            echo "If Electron still cannot find system libraries, try: nix run .#fhs"
          '';
        in
        {
          default = pkgs.mkShell {
            packages = devTools ++ electronRuntimeLibs;
            shellHook = commonShellHook;
          };
        }
      );

      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };

          devTools = with pkgs; [
            nodejs
            pnpm
            git
            procps
            curl
            jq
            pkg-config
            python3
            gcc
            gnumake
            bashInteractive
          ];

          electronRuntimeLibs = with pkgs; [
            alsa-lib
            at-spi2-atk
            at-spi2-core
            atk
            cairo
            cups
            dbus
            expat
            gdk-pixbuf
            glib
            gtk3
            libdrm
            libgbm
            libnotify
            libpulseaudio
            libsecret
            libxkbcommon
            mesa
            nspr
            nss
            pango
            pipewire
            stdenv.cc.cc
            udev
            wayland
            xdg-desktop-portal
            xdg-desktop-portal-gtk
            xdg-utils
            libice
            libsm
            libx11
            libxscrnsaver
            libxcomposite
            libxcursor
            libxdamage
            libxext
            libxfixes
            libxi
            libxrandr
            libxrender
            libxtst
            libxcb
            libxshmfence
          ];
        in
        {
          fhs = pkgs.buildFHSEnv {
            name = "qh-screenshare-fhs";
            targetPkgs = _: devTools ++ electronRuntimeLibs;
            runScript = "bash";
            profile = ''
              export ELECTRON_OZONE_PLATFORM_HINT="''${ELECTRON_OZONE_PLATFORM_HINT:-auto}"
              export NIXOS_OZONE_WL="''${NIXOS_OZONE_WL:-1}"
              export PATH="${pkgs.procps}/bin:$PATH"
            '';
          };
        }
      );

      apps = forAllSystems (system: {
        fhs = {
          type = "app";
          program = "${self.packages.${system}.fhs}/bin/qh-screenshare-fhs";
        };
      });
    };
}
