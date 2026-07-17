# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Install 'serve' globally to host static files
RUN npm install -g serve

# Copy only the built assets from the builder stage
COPY --from=builder /app/dist /app/dist

# Expose the port 'serve' uses by default
EXPOSE 3000

# Start the server on the dist folder
CMD ["serve", "-s", "dist", "-l", "3000"]