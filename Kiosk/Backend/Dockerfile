# Backend Dockerfile for Development
FROM node:20-alpine

WORKDIR /app

# Install nmcli for WiFi management on Raspberry Pi
RUN apk add --no-cache networkmanager

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
