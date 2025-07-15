FROM ubuntu:20.04

# Install dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y curl build-essential pkg-config libssl-dev git ca-certificates gnupg2 && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana CLI (latest stable)
RUN sh -c "$(curl -sSfL https://release.solana.com/stable/install)" || \
    (curl -sSfL https://release.solana.com/v1.18.14/install | sh)
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install avm (Anchor Version Manager) via cargo and latest Anchor
RUN cargo install --git https://github.com/coral-xyz/anchor avm --force && \
    /root/.cargo/bin/avm install latest && \
    /root/.cargo/bin/avm use latest
ENV PATH="/root/.avm/bin:${PATH}"

# Set workdir
WORKDIR /work

# Default command
CMD ["bash"] 