#!/bin/sh
# Préparation de MinIO pour la GED (idempotent : relancé à chaque « docker compose up »).
#  - bucket privé des documents, avec versionnage (un objet écrasé ou supprimé reste récupérable)
#  - compte dédié à l'application : lecture et écriture, mais aucune suppression
# Le compte administrateur (MINIO_ROOT_USER) ne sert qu'à cette préparation et à la console.
# L'image ne contient ni sed ni grep : uniquement du shell POSIX et mc.
set -eu

mc alias set ged http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

mc mb --ignore-existing "ged/$S3_BUCKET"
mc version enable "ged/$S3_BUCKET"
mc anonymous set none "ged/$S3_BUCKET" >/dev/null

# Droits du compte applicatif : lister le bucket, lire et déposer des objets. Pas de DeleteObject.
cat > /tmp/ged-app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LireLeBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Sid": "LireEtEcrireLesDocumentsSansSupprimer",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
EOF
mc admin policy create ged ged-app /tmp/ged-app-policy.json
# « user add » sur un compte existant met simplement son mot de passe à jour
mc admin user add ged "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc admin policy attach ged ged-app --user "$S3_ACCESS_KEY" >/dev/null 2>&1 || true

# Compte de destruction : seul autorisé à supprimer (toutes versions), utilisé uniquement pour exécuter
# un bordereau d'élimination visé. Facultatif : sans lui, les éliminations échouent côté stockage.
if [ -n "${S3_DISPOSAL_SECRET_KEY:-}" ]; then
  cat > /tmp/ged-disposal-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListerLesVersions",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketVersions", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Sid": "DetruireLesDocumentsElimines",
      "Effect": "Allow",
      "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
EOF
  mc admin policy create ged ged-disposal /tmp/ged-disposal-policy.json
  mc admin user add ged "$S3_DISPOSAL_ACCESS_KEY" "$S3_DISPOSAL_SECRET_KEY"
  mc admin policy attach ged ged-disposal --user "$S3_DISPOSAL_ACCESS_KEY" >/dev/null 2>&1 || true
fi

echo "MinIO prêt : bucket « $S3_BUCKET », comptes « $S3_ACCESS_KEY »${S3_DISPOSAL_SECRET_KEY:+ et « $S3_DISPOSAL_ACCESS_KEY »}"
