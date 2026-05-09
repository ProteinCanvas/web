FROM node:22-alpine AS builder
ARG BASE_PATH=""
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV NEXT_PUBLIC_BASE_PATH=$BASE_PATH
ENV NEXT_EXPORT=1
RUN npm run build

FROM nginx:alpine AS runner
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["sh", "-c", "sed \"s|__BASE_PATH__|${BASE_PATH}|g\" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
