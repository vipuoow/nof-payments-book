#!/usr/bin/env python3
"""아이폰 단축어 '가계부로 보내기'를 만들고 서명한다(macOS 전용, 단축어 앱 로그인 필요).

단축어 동작:
  0. 텍스트 = 연결 코드("<받는 주소> <토큰>"). 추가한 뒤 사용자가 이 칸의 자리 글자를 지우고 붙여넣는다.
     (추가 화면에서 묻는 방식은 아이폰에서 [단축어 추가]가 눌리지 않아 쓰지 않는다.
      이 칸은 일반 문자열로 두면 편집기에서 고칠 수 없어서 변수 문자열 형식으로 넣는다)
  1. 연결 코드를 공백으로 나눔 → 2. 첫 항목 = 주소, 3. 마지막 항목 = 토큰
  4. 단축어 입력(문자)에서 텍스트를 꺼냄
  5. 주소로 POST, Authorization: Bearer <토큰>, JSON {body: 문자 내용, source: ios_shortcut}
손으로 실행하면 문자 내용이 비어 있어 서버가 '연결 확인'으로 처리한다.
주소·토큰은 파일에 들어 있지 않으므로 공개 저장소에 두어도 된다.

사용법: python3 scripts/build-ios-shortcut.py
"""
from __future__ import annotations

import os
import plistlib
import subprocess
import tempfile
import uuid

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "shortcuts", "가계부로 보내기.shortcut")
OBJ = "\ufffc"  # 변수 자리 표시 문자
PLACEHOLDER = "여기에연결코드붙여넣기"  # 공백이 없어야 한다(단축어가 공백으로 주소와 토큰을 나눈다)


def uid() -> str:
    return str(uuid.uuid4()).upper()


def output(u: str, name: str) -> dict:
    return {"OutputUUID": u, "OutputName": name, "Type": "ActionOutput"}


def attachment(value: dict) -> dict:
    return {"Value": value, "WFSerializationType": "WFTextTokenAttachment"}


def text(s: str, vars_: dict | None = None) -> dict:
    """vars_: {문자열 안 위치: 변수} — 위치의 OBJ 한 글자가 변수로 바뀐다."""
    return {
        "Value": {
            "string": s,
            "attachmentsByRange": {f"{{{pos}, 1}}": v for pos, v in (vars_ or {}).items()},
        },
        "WFSerializationType": "WFTextTokenString",
    }


def dictionary(items: list[tuple[str, dict]]) -> dict:
    return {
        "Value": {
            "WFDictionaryFieldValueItems": [
                {"WFItemType": 0, "WFKey": text(k), "WFValue": v} for k, v in items
            ]
        },
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def action(identifier: str, params: dict) -> dict:
    return {"WFWorkflowActionIdentifier": identifier, "WFWorkflowActionParameters": params}


def build() -> dict:
    code, split, url, token, message = uid(), uid(), uid(), uid(), uid()
    actions = [
        action("is.workflow.actions.gettext", {"UUID": code, "WFTextActionText": text(PLACEHOLDER)}),
        action("is.workflow.actions.text.split", {
            "UUID": split,
            "text": attachment(output(code, "텍스트")),
            "WFTextSeparator": "Spaces",
        }),
        action("is.workflow.actions.getitemfromlist", {
            "UUID": url,
            "WFInput": attachment(output(split, "분할된 텍스트")),
            "WFItemSpecifier": "First Item",
        }),
        action("is.workflow.actions.getitemfromlist", {
            "UUID": token,
            "WFInput": attachment(output(split, "분할된 텍스트")),
            "WFItemSpecifier": "Last Item",
        }),
        action("is.workflow.actions.detect.text", {
            "UUID": message,
            "WFInput": attachment({"Type": "ExtensionInput"}),
        }),
        action("is.workflow.actions.downloadurl", {
            "UUID": uid(),
            "WFURL": text(OBJ, {0: output(url, "목록의 항목")}),
            "WFHTTPMethod": "POST",
            "ShowHeaders": True,
            "WFHTTPHeaders": dictionary([("Authorization", text(f"Bearer {OBJ}", {7: output(token, "목록의 항목")}))]),
            "WFHTTPBodyType": "JSON",
            "WFJSONValues": dictionary([
                ("body", text(OBJ, {0: output(message, "텍스트")})),
                ("source", text("ios_shortcut")),
            ]),
        }),
    ]
    return {
        "WFWorkflowActions": actions,
        "WFWorkflowClientVersion": "2607.0.2",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4292093695, "WFWorkflowIconGlyphNumber": 59511},
        "WFWorkflowImportQuestions": [],
        "WFWorkflowInputContentItemClasses": [
            "WFStringContentItem",
            "WFGenericFileContentItem",
            "WFRichTextContentItem",
        ],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowTypes": [],
        "WFQuickActionSurfaces": [],
    }


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        unsigned = os.path.join(tmp, "가계부로 보내기.shortcut")
        with open(unsigned, "wb") as f:
            plistlib.dump(build(), f, fmt=plistlib.FMT_BINARY)
        subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", OUT], check=True)
    os.chmod(OUT, 0o644)  # 이미지 안에서 앱 사용자가 읽을 수 있게
    print(f"만듦: {os.path.normpath(OUT)} ({os.path.getsize(OUT)} 바이트)")


if __name__ == "__main__":
    main()
