###################
# DEVELOPMENT
###################
FROM node:20-alpine AS development

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

USER node

###################
# BUILD
###################
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY . .

RUN npm run build

ENV NODE_ENV production
RUN npm ci --only=production && npm cache clean --force

USER node

###################
# PRODUCTION
###################
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

RUN mkdir -p uploads && chown -R node:node uploads

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
