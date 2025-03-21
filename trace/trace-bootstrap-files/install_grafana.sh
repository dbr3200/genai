#!/bin/bash -xev

# Add the Grafana repo and install Grafana Enterprise
wget -q -O gpg.key https://rpm.grafana.com/gpg.key;
rpm --import gpg.key;
touch /etc/yum.repos.d/grafana.repo;
echo "[grafana]
name=grafana
baseurl=https://rpm.grafana.com
enabled=1
gpgcheck=1
gpgkey=https://rpm.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
" > /etc/yum.repos.d/grafana.repo;

yum -y install grafana-enterprise;

# Load the custom Grafana Confs in the systemd env vaibles file
echo "Exporting Grafana ENV Variables"
echo "GF_AUTH_JWT_ENABLED=true" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_HEADER_NAME=X-JWT-Assertion" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_EMAIL_CLAIM=email" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_USERNAME_CLAIM=custom:username" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_JWK_SET_URL=$COGNITO_JWKS_URL" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_EXPECT_CLAIMS={\"iss\":\"$COGNITO_TOKEN_ISS\"}" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_AUTO_SIGN_UP=true" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_URL_LOGIN=true" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_ROLE_ATTRIBUTE_PATH=\"\\\"custom:attr3\\\" | contains(@,'trace') && 'Viewer'\"" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_JWT_ROLE_ATTRIBUTE_STRICT=true" >> /etc/sysconfig/grafana-server
echo "GF_AUTH_SIGV4_AUTH_ENABLED=true" >> /etc/sysconfig/grafana-server
echo "GF_PATHS_DATA=$GRAFANA_DATA_PATH/grafana" >> /etc/sysconfig/grafana-server
echo "GF_PATHS_PLUGINS=$GRAFANA_DATA_PATH/grafana/plugins" >> /etc/sysconfig/grafana-server
echo "GF_SECURITY_ALLOW_EMBEDDING=true" >> /etc/sysconfig/grafana-server

# Install the athena datasource if not installed
echo "Installing plugins if necessary"
if [ -z "$(grafana-cli --pluginsDir "$GRAFANA_DATA_PATH/grafana/plugins" plugins ls | grep grafana-athena-datasource)" ]; then
    echo "Athena Plugin does not exists, installing..."
    grafana-cli --pluginsDir "$GRAFANA_DATA_PATH/grafana/plugins" plugins install grafana-athena-datasource
    # TODO Pin to a version
else
    echo "Athena Plugin already exists, skipping install"
fi

# Install the opensearch datasource if not installed
if [ -z "$(grafana-cli --pluginsDir "$GRAFANA_DATA_PATH/grafana/plugins" plugins ls | grep grafana-opensearch-datasource)" ]; then
    echo "Athena Plugin does not exists, installing..."
    grafana-cli --pluginsDir "$GRAFANA_DATA_PATH/grafana/plugins" plugins install grafana-opensearch-datasource
    # TODO Pin to a version
else
    echo "Athena Plugin already exists, skipping install"
fi

# Set the file permissions for the grafana group to GRAFANA_DATA_PATH
chown -R root:grafana $GRAFANA_DATA_PATH
chmod -R 775 $GRAFANA_DATA_PATH

# Sleep for 5 sec before staring the service
sleep 5

# Start the Grafana service
sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Disable tracing to hide the secret
set +x

# Get the password from the secret and change the default admin password
GRAFANA_ADMIN_SECRET=$(aws secretsmanager get-secret-value --secret-id $GRAFANA_ADMIN_SECRET --query SecretString --region $AWS_REGION --output text)
GRAFANA_ADMIN_PASSWORD=$(echo $GRAFANA_ADMIN_SECRET | jq -r '.password')
export GF_DATABASE_PATH=$GRAFANA_DATA_PATH/grafana/grafana.db

# Check if the following file is present. This file is created from the
# pipeline once the password is reset for the first time. 
# This is done to prevent the password getting reset every time the 
# ASG launches a new instance. This will ensure that even if the 
# customer changes the admin password later, it won't be reverted back
if [ -f "$GRAFANA_DATA_PATH/grafana/conf_status" ]; then
    echo "Admin password already set"
else
    echo "Changing the default admin password"
    grafana-cli admin reset-admin-password "'$GRAFANA_ADMIN_PASSWORD'"
    echo "SUCCESS" > $GRAFANA_DATA_PATH/grafana/conf_status
fi;

# Enable tracing back
set -x