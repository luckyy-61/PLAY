FROM node:20-alpine

# Install Python and ffmpeg required for yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg curl

# Download and install the latest Linux version of yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all other backend source files
COPY . .

# Expose the API port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
