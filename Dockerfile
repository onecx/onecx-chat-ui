FROM ghcr.io/onecx/docker-spa-base:1.10.0

# Copy nginx configuration
COPY nginx/locations.conf $DIR_LOCATION/locations.conf
COPY nginx/voice-bff.conf $DIR_LOCATION/voice-bff.conf

# Copy custom entrypoint script
COPY scripts/custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

# Copy application build
COPY dist/onecx-chat-ui/ $DIR_HTML

# Optional extend list of application environments
ENV CONFIG_ENV_EXT_LIST=VOICE_AI_ENABLED,VOICE_BFF_URL

# Application environments default values
ENV BFF_URL=http://onecx-chat-bff:8080/
ENV APP_BASE_HREF=/
ENV VOICE_AI_ENABLED=false

RUN chmod 775 -R "$DIR_HTML"/assets
USER 1001

ENTRYPOINT ["/bin/bash", "/custom-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]