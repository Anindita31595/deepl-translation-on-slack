# Use the official Deno image
FROM denoland/deno:latest

# Set working directory
WORKDIR /app

# Copy all application files
COPY . .

# Verify the server file exists and can be parsed
RUN deno check server.ts || (echo "Error: server.ts has syntax errors" && exit 1)

# Expose port (Render will provide PORT via env var, default to 10000)
EXPOSE 10000

# Run the server
# Render sets PORT automatically, but we need to read it from env
# Required permissions: --allow-net (HTTP requests), --allow-env (environment variables)
CMD ["deno", "run", "--allow-net", "--allow-env", "server.ts"]

