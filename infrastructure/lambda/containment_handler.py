import json
import logging
import os
from typing import Any, Dict

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns = boto3.client("sns")


def summarize_event(event: Dict[str, Any]) -> Dict[str, Any]:
    detail = event.get("detail", {})
    source = event.get("source", "unknown")
    severity = detail.get("severity", detail.get("Severity", "unknown"))
    title = detail.get("title") or detail.get("Title") or detail.get("type") or detail.get("findingArn") or "Cloud security finding"
    resource = detail.get("resource", {}).get("instanceDetails", {}).get("instanceId")
    if not resource and isinstance(detail.get("resources"), list) and detail["resources"]:
        resource = detail["resources"][0].get("id")

    return {
        "source": source,
        "severity": severity,
        "title": title,
        "resource": resource,
        "detail": detail,
    }


def publish_alert(summary: Dict[str, Any]) -> None:
    topic_arn = os.environ.get("ALERT_TOPIC_ARN", "")
    if not topic_arn:
        logger.info("No ALERT_TOPIC_ARN configured; skipping SNS publish")
        return

    message = {
        "mode": os.environ.get("AUTO_RESPONSE_MODE", "simulate"),
        "title": summary["title"],
        "severity": summary["severity"],
        "resource": summary.get("resource"),
        "source": summary["source"],
        "response": "Containment simulated or executed by Lambda responder",
    }

    sns.publish(
        TopicArn=topic_arn,
        Subject=f"[{summary['source']}] {summary['title']}",
        Message=json.dumps(message, indent=2),
    )


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    summary = summarize_event(event)
    mode = os.environ.get("AUTO_RESPONSE_MODE", "simulate")

    logger.info("Received cloud security event: %s", json.dumps(summary, default=str))

    actions = []
    if summary["source"] == "aws.guardduty":
        actions.append("Evaluate isolation of the affected workload security group")
        actions.append("Record a containment marker for the incident timeline")
    elif summary["source"] == "aws.inspector2":
        actions.append("Create or update remediation work item for the vulnerable host or image")
    else:
        actions.append("Log the event and notify the analyst team")

    if mode == "enforce":
        logger.info("AUTO_RESPONSE_MODE=enforce. Real security-group or IAM mutations would run here.")
    else:
        logger.info("AUTO_RESPONSE_MODE=%s. No destructive action will be taken.", mode)

    publish_alert(summary)

    return {
        "ok": True,
        "mode": mode,
        "actions": actions,
        "resource": summary.get("resource"),
        "title": summary["title"],
        "request_id": getattr(context, "aws_request_id", "unknown"),
    }
