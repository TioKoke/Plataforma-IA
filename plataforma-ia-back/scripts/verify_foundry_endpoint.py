"""
Verificación de opciones disponibles para Agent Service con contexto/threads.
Ejecutar: python scripts/verify_foundry_endpoint.py
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

PROJECT_ENDPOINT = "https://your-foundry-resource.services.ai.azure.com/api/projects/your-foundry-project"
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-5.2-chat")
FOUNDRY_API_KEY = os.getenv("FOUNDRY_API_KEY", "")


async def test_project_client():
    """Test 1: client.get_openai_client() desde azure-ai-projects"""
    print("\n" + "="*60)
    print("TEST 1: azure-ai-projects → get_openai_client()")
    print("="*60)
    try:
        from azure.ai.projects.aio import AIProjectClient
        from azure.core.credentials import AzureKeyCredential

        async with AIProjectClient(
            endpoint=PROJECT_ENDPOINT,
            credential=AzureKeyCredential(FOUNDRY_API_KEY),
        ) as client:
            # get_openai_client() devuelve un cliente OpenAI configurado para este proyecto
            openai_client = client.get_openai_client()
            print(f"✅ get_openai_client() retorna: {type(openai_client).__name__}")
            print(f"   base_url: {openai_client.base_url}")

            # Ver si tiene Assistants API (beta.assistants)
            has_assistants = hasattr(openai_client, 'beta') and hasattr(openai_client.beta, 'assistants')
            print(f"   ¿Tiene beta.assistants?: {has_assistants}")

            # Probar un completion básico
            response = await openai_client.chat.completions.create(
                model=CHAT_MODEL,
                messages=[{"role": "user", "content": "Di solo 'OK'"}],
                max_completion_tokens=10,
            )
            print(f"✅ Chat completion OK: '{response.choices[0].message.content}'")

    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")


async def test_openai_assistants():
    """Test 2: Azure OpenAI Assistants API (threads/runs nativos)"""
    print("\n" + "="*60)
    print("TEST 2: OpenAI Assistants API via OPENAI_BASE_URL")
    print("="*60)
    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=OPENAI_API_KEY,
            azure_endpoint=OPENAI_BASE_URL.replace("/openai/v1/", ""),
            api_version="2024-05-01-preview",  # versión con Assistants
        )

        print(f"   endpoint: {OPENAI_BASE_URL}")
        print(f"   ¿Tiene beta.assistants?: {hasattr(client.beta, 'assistants')}")

        # Intentar crear un assistant (equivalente a Agent)
        assistant = await client.beta.assistants.create(
            model=CHAT_MODEL,
            name="test-assistant",
            instructions="Responde solo 'OK'.",
        )
        print(f"✅ Assistant creado: {assistant.id}")

        # Crear thread (sesión persistente con historial en Azure)
        thread = await client.beta.threads.create(
            metadata={"user_id": "test_user", "division": "TI"}
        )
        print(f"✅ Thread creado: {thread.id}")
        print(f"   metadata: {thread.metadata}")

        # Enviar mensaje
        await client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content="test"
        )

        # Ejecutar con contexto del usuario via instructions adicionales
        run = await client.beta.threads.runs.create_and_poll(
            thread_id=thread.id,
            assistant_id=assistant.id,
            additional_instructions="Usuario: Jorge Tapia | División: Abastecimiento"
        )
        print(f"✅ Run status: {run.status}")

        if run.status == "completed":
            messages = await client.beta.threads.messages.list(thread_id=thread.id)
            for msg in messages.data:
                if msg.role == "assistant":
                    text = msg.content[0].text.value if msg.content else "(vacío)"
                    print(f"✅ Respuesta: '{text}'")
                    break

        # Limpiar
        await client.beta.assistants.delete(assistant.id)
        print("\n✅ TEST 2 COMPLETO — Assistants API disponible")
        print("   → Threads persistentes en Azure ✓")
        print("   → Thread metadata (contexto usuario) ✓")
        print("   → additional_instructions por run ✓")

    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")
        if "api_version" in str(e).lower() or "not found" in str(e).lower():
            print("   → Assistants API no disponible en este endpoint/versión")
        if "model" in str(e).lower():
            print(f"   → El modelo '{CHAT_MODEL}' puede no estar disponible para Assistants")


async def test_azure_ai_agents():
    """Test 3: azure-ai-agents package directo"""
    print("\n" + "="*60)
    print("TEST 3: azure-ai-agents package directo")
    print("="*60)
    try:
        from azure.ai.agents.aio import AgentsClient
        from azure.core.credentials import AzureKeyCredential

        client = AgentsClient(
            endpoint=PROJECT_ENDPOINT,
            credential=AzureKeyCredential(FOUNDRY_API_KEY),
        )
        print(f"✅ AgentsClient creado")
        print(f"   Métodos: {[m for m in dir(client) if not m.startswith('_')][:10]}")

    except ImportError:
        print("❌ azure-ai-agents no está instalado como paquete separado")
        print("   Instalar: pip install azure-ai-agents")
    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")


async def main():
    print(f"📦 Verificando opciones para Agent Service con contexto")
    await test_project_client()
    await test_openai_assistants()
    await test_azure_ai_agents()
    print("\n" + "="*60)
    print("FIN DE VERIFICACIÓN")


if __name__ == "__main__":
    asyncio.run(main())
