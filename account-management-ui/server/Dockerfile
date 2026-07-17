FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --production --no-audit --no-fund

# Copy source
COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["node", "index.js"]