# Pinkeepr Deployment Guide

Secure OpenClaw AI deployment for Umbrel, communicating exclusively via Nostr with a single trusted identity (Oracle).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TAILSCALE MESH                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ws://relay     ┌──────────────────────┐  │
│  │   Oracle     │ ◄────────────────► │      Umbrel          │  │
│  │  (Your npub) │                    │  ┌────────────────┐  │  │
│  │              │                    │  │ Private Relay  │  │  │
│  │  Damus/      │                    │  │   (port 4848)  │  │  │
│  │  Amethyst    │                    │  └───────┬────────┘  │  │
│  └──────────────┘                    │          │           │  │
│                                      │          ▼           │  │
│                                      │  ┌────────────────┐  │  │
│  ┌──────────────┐                    │  │   Pinkeepr     │  │  │
│  │   Laptop     │  http://100.x:11434│  │   (OpenClaw)   │  │  │
│  │  ┌────────┐  │ ◄──────────────────┤  │   Container    │  │  │
│  │  │ Ollama │  │                    │  └────────────────┘  │  │
│  │  │  LLM   │  │                    │                      │  │
│  │  └────────┘  │                    │  ┌────────────────┐  │  │
│  └──────────────┘                    │  │   Portainer    │  │  │
│                                      │  │   (optional)   │  │  │
│                                      │  └────────────────┘  │  │
│                                      └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Features

- ✅ **Single trusted npub**: Pinkeepr only responds to Oracle's pubkey
- ✅ **Private relay**: All traffic stays off public Nostr relays
- ✅ **Tailscale-only**: No public network exposure
- ✅ **No Docker socket**: Container cannot escape to host
- ✅ **Non-root container**: Reduced privilege
- ✅ **Read-only filesystem**: Immutable container
- ✅ **Dropped capabilities**: Minimal Linux permissions

## Prerequisites

1. **Umbrel** with:
   - Private Nostr relay (e.g., nostr-rs-relay, strfry)
   - Portainer for container management
   - Tailscale installed and connected

2. **Laptop** with:
   - Ollama running with your preferred models
   - Tailscale connected to same network

3. **Generated keys**:
   - Pinkeepr's nsec/npub (bot identity)
   - Oracle's npub (your identity)

## Step-by-Step Deployment

### 1. Generate Keys (if not done)

```bash
# Using nak CLI (https://github.com/fiatjaf/nak)
nak key generate

# Output:
# nsec1... (private key - keep secret!)
# npub1... (public key - share this)
```

Generate one keypair for Pinkeepr (the bot) and use your existing npub for Oracle.

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit with your values
nano .env
```

Fill in these required values:

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | API auth token | `openssl rand -hex 32` |
| `PINKEEPR_NSEC` | Bot's private key | `nsec1abc...` |
| `ORACLE_NPUB` | Your public key | `npub1xyz...` |
| `NOSTR_RELAY_URL` | Private relay | `ws://umbrel.local:4848` |
| `OLLAMA_HOST` | Laptop's Tailscale IP | `http://100.79.12.80:11434` |
| `TAILSCALE_IP` | Umbrel's Tailscale IP | `100.64.1.2` |

```bash
# Secure the env file
chmod 600 .env
```

### 3. Configure Pinkeepr

Edit `config.json5` and replace placeholders:

```json5
{
  channels: {
    nostr: {
      privateKey: "${PINKEEPR_NSEC}",
      relays: ["ws://umbrel.local:4848"],  // Your relay
      dmPolicy: "allowlist",
      allowFrom: ["npub1your-oracle-pubkey"]  // Your npub
    }
  },
  models: {
    providers: {
      ollama: {
        baseUrl: "http://100.79.12.80:11434/v1"  // Your Ollama
      }
    }
  }
}
```

### 4. Deploy via Portainer

#### Option A: Git Stack (Recommended)

1. In Portainer, go to **Stacks** → **Add stack**
2. Select **Repository**
3. Repository URL: `https://github.com/your-fork/openclaw`
4. Compose path: `pinkeepr/docker-compose.pinkeepr.yml`
5. Add environment variables from your `.env`
6. Click **Deploy**

#### Option B: Paste YAML

1. In Portainer, go to **Stacks** → **Add stack**
2. Select **Web editor**
3. Paste contents of `docker-compose.pinkeepr.yml`
4. Add environment variables manually
5. Click **Deploy**

### 5. Install Nostr Plugin

After the container starts, install the Nostr extension:

```bash
# SSH into Umbrel or use Portainer console
docker exec -it pinkeepr node dist/index.js plugins install @openclaw/nostr
```

Then restart the container to load the plugin.

### 6. Verify Deployment

```bash
# Check container is running
docker ps | grep pinkeepr

# Check logs
docker logs pinkeepr -f

# Verify Nostr channel is connected
docker exec pinkeepr node dist/index.js channels status
```

### 7. Test Communication

1. Open your Nostr client (Damus, Amethyst, etc.)
2. Add Pinkeepr's npub as a contact
3. Send an encrypted DM: "Hello Pinkeepr!"
4. Verify you receive a response

## Troubleshooting

### Pinkeepr not responding

1. **Check allowlist**: Ensure your npub is in `allowFrom`
   ```bash
   docker exec pinkeepr cat /home/node/.openclaw/config.json5 | grep allowFrom
   ```

2. **Check relay connection**:
   ```bash
   docker logs pinkeepr | grep -i relay
   ```

3. **Verify private key**:
   ```bash
   # Derive npub from nsec to confirm they match
   nak key public <your-nsec>
   ```

### Ollama connection failed

1. **Check Tailscale connectivity**:
   ```bash
   # From Umbrel
   curl http://100.79.12.80:11434/api/tags
   ```

2. **Ensure Ollama is listening on all interfaces**:
   ```bash
   # On your laptop
   OLLAMA_HOST=0.0.0.0 ollama serve
   ```

### Container won't start

1. **Check volume permissions**:
   ```bash
   ls -la /path/to/pinkeepr_config
   # Should be owned by uid 1000
   ```

2. **Check Docker logs**:
   ```bash
   docker logs pinkeepr
   ```

## Security Checklist

- [ ] `.env` file has `chmod 600`
- [ ] Private relay is not exposed to public internet
- [ ] Ollama only accepts connections from Tailscale IPs
- [ ] Portainer API token has minimal scopes (if used)
- [ ] `dmPolicy` is set to `allowlist`
- [ ] Only Oracle's npub is in `allowFrom`
- [ ] Container runs as non-root (uid 1000)
- [ ] No Docker socket mounted in container

## Updating Pinkeepr

```bash
# Pull latest image
docker pull ghcr.io/openclaw/openclaw:latest

# Restart container
docker restart pinkeepr

# Or via Portainer: Stack → pinkeepr → Update
```

## Files Reference

```
pinkeepr/
├── docker-compose.pinkeepr.yml  # Hardened Docker Compose
├── config.json5                 # OpenClaw configuration
├── .env.example                 # Environment template
├── .env                         # Your actual config (git-ignored)
└── README.md                    # This file
```
