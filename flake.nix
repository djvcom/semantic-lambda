{
  description = "OpenTelemetry semantic span wrapper for AWS Lambda handlers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            corepack_24
          ];

          shellHook = ''
            echo "semantic-lambda development environment"
            echo "Node.js $(node --version)"
            echo "Yarn $(yarn --version 2>/dev/null || echo 'run: corepack enable && yarn')"
          '';
        };
      }
    );
}
