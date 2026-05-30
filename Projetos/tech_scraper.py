import urllib.request
import xml.etree.ElementTree as ET
import os
import html
import re
from datetime import datetime

WORKSPACE_ROOT = '/storage/emulated/0/Workspace'
OUTPUT_DIR = os.path.join(WORKSPACE_ROOT, 'Cerebro', '02_Memoria')

# Feeds RSS de portais brasileiros de tecnologia
FEEDS = [
    {
        "nome": "Tecnoblog",
        "url": "https://tecnoblog.net/feed/",
        "max": 3
    },
    {
        "nome": "Olhar Digital",
        "url": "https://olhardigital.com.br/feed/",
        "max": 2
    }
]

def fetch_rss(url):
    """Busca e parseia um feed RSS."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return ET.fromstring(response.read())

def clean_html(raw_html):
    """Remove tags HTML de um texto."""
    clean = re.sub(r'<[^>]+>', '', raw_html)
    return html.unescape(clean).strip()

def truncate(text, max_len=200):
    """Trunca o texto para um tamanho maximo."""
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(' ', 1)[0] + '...'

def main():
    print("Iniciando varredura de noticias tech PT/BR...")
    now = datetime.now()
    
    markdown_content = f"""---
aliases: [Noticias Tech PT-BR]
---
# \U0001f1e7\U0001f1f7 Tend\u00eancias Tech do Dia (Portugu\u00eas)
*Gerado de forma aut\u00f4noma pelo Android Edge AI em {now.strftime('%d/%m/%Y %H:%M:%S')}*
"""

    total_noticias = 0
    erros = []

    for feed_info in FEEDS:
        nome = feed_info["nome"]
        url = feed_info["url"]
        max_items = feed_info["max"]
        
        markdown_content += f"\n## {nome}\n"
        
        try:
            root = fetch_rss(url)
            channel = root.find('channel')
            if channel is None:
                markdown_content += f"- *Feed indispon\u00edvel no momento*\n"
                erros.append(nome)
                continue
            
            items = channel.findall('item')[:max_items]
            
            for i, item in enumerate(items, 1):
                title = item.findtext('title', 'Sem t\u00edtulo')
                link = item.findtext('link', '#')
                desc_raw = item.findtext('description', '')
                description = truncate(clean_html(desc_raw))
                pub_date = item.findtext('pubDate', '')
                
                total_noticias += 1
                markdown_content += f"\n### {i}. [{title}]({link})\n"
                if description:
                    markdown_content += f"> {description}\n"
                if pub_date:
                    markdown_content += f"- *Publicado em:* {pub_date}\n"
                    
        except Exception as e:
            markdown_content += f"- *Erro ao acessar feed: {e}*\n"
            erros.append(nome)

    # Footer com tags para o Obsidian
    markdown_content += f"\n---\n"
    markdown_content += f"**Total de not\u00edcias capturadas:** {total_noticias}\n"
    if erros:
        markdown_content += f"**Feeds com erro:** {', '.join(erros)}\n"
    markdown_content += f"**Tags:** #tech #noticias #ptbr #automacao #agente-android\n"

    # Salva o arquivo no cofre do Obsidian
    date_str = now.strftime("%Y-%m-%d")
    file_path = os.path.join(OUTPUT_DIR, f"Tendencias_Tech_{date_str}.md")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
        
    print(f"Sucesso! {total_noticias} noticias capturadas de {len(FEEDS)} fontes.")
    print(f"Nota Obsidian gerada em: Cerebro/02_Memoria/Tendencias_Tech_{date_str}.md")

if __name__ == '__main__':
    main()