"""Private stdio bridge. Only four bounded read tools; never prints diagnostics/data to logs."""
import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

TOOLS = frozenset({'status', 'sessions', 'timeline', 'read_events'})


def payload(result):
    if isinstance(result.structuredContent, dict):
        return result.structuredContent
    for block in result.content:
        if block.type == 'text':
            try:
                data = json.loads(block.text)
                if isinstance(data, dict):
                    return data
            except ValueError:
                pass
    return {'ok': False, 'error': {'code': 'invalid_result'}}


def identity(config):
    # Identity separates cursors across accounts without returning an account ID or key.
    account = json.loads(Path(config.get('key_config', Path.home() / '.config/wxcli/config.json')).read_text())
    return hashlib.sha256(json.dumps([account['wxid'], account['db_root']]).encode()).hexdigest()


def emit(value):
    print(json.dumps(value, ensure_ascii=False, separators=(',', ':')), flush=True)


async def main():
    config = json.loads(Path(sys.argv[1]).read_text())
    env = os.environ.copy()
    env.update({
        'WECHAT_MCP_CLI_PATH': config['cli'], 'WECHAT_MCP_WCDB_LIB': config['wcdb'],
        'WECHAT_CLI_STATE_DIR': config['metadata_state'], 'WECHAT_CLI_STRICT_READ_ONLY': '1',
        'WXKEY_NO_ELEVATE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
        'PYTHONPATH': str(Path(config['project'])/'src'),
    })
    for flag in ['MEDIA', 'DERIVED_WRITES', 'OCR', 'FILE_TEXT', 'VOICE', 'NETWORK']:
        env['WECHAT_MCP_ENABLE_' + flag] = '0'
    if config.get('key_config'):
        env['WECHAT_CLI_CONFIG'] = config['key_config']
    params = StdioServerParameters(command=config['python'], args=['-B', '-m', 'wechat_cli_mcp.server'],
                                   cwd=config['project'], env=env)
    with open(os.devnull, 'w') as errlog:
        async with stdio_client(params, errlog=errlog) as (reader, writer):
            async with ClientSession(reader, writer) as session:
                await asyncio.wait_for(session.initialize(), 30)
                emit({'ready': True})
                while True:
                    line = await asyncio.to_thread(sys.stdin.readline, 1024 * 1024)
                    if not line:
                        return
                    req = json.loads(line)
                    rid = req['id']
                    if req.get('tool') not in TOOLS:
                        emit({'id': rid, 'ok': False, 'code': 'tool_not_allowed'})
                        continue
                    try:
                        account = identity(config)
                        result = payload(await asyncio.wait_for(session.call_tool(req['tool'], req.get('input', {})), 30))
                        if identity(config) != account:
                            emit({'id': rid, 'ok': False, 'code': 'account_changed'})
                        elif result.get('ok') is True:
                            emit({'id': rid, 'ok': True, 'identity': account, 'data': result.get('data', {})})
                        else:
                            # Upstream messages may contain local paths, names or plaintext; never forward errors.
                            emit({'id': rid, 'ok': False, 'code': 'read_failed'})
                    except Exception:
                        emit({'id': rid, 'ok': False, 'code': 'read_failed'})


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except BaseException:
        raise SystemExit(1)
