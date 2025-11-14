FROM denoland/deno:latest

WORKDIR /app

# Copy all files to ensure context is correct
COPY . .

# Expose port (Render sets PORT automatically)
EXPOSE 10000

# Run the server- Render sets PORT env var automatically
# Using exec form for better signal handling
CMD ["deno", "run", "--allow-net", "--allow-env", "server.ts"]

