
import os
import asyncio
import json
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

async def main():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)

    # Content for TR
    config_tr = [
        {
            "key": "hero",
            "locale": "tr",
            "content": {
                "top_label": "Yapay Zeka Destekli Otel Fiyat İstihbaratı",
                "title_main": "Rakiplerinizin Fiyatlarını",
                "title_highlight": "Gerçek Zamanlı",
                "title_suffix": "Takip Edin",
                "description": "Otelinizin kârlılığını şansa bırakmayın. Piyasa verilerini rekabet avantajına dönüştürün ve gelir yönetimi stratejinizi kesin bilgiyle güçlendirin.",
                "cta_primary": "Erişim Talebi Oluşturun",
                "cta_secondary": "Üyelik Planlarını İnceleyin"
            }
        },
        {
            "key": "stats",
            "locale": "tr",
            "content": [
                {"value": 50, "suffix": "+", "label": "Aktif Otel"},
                {"value": 24, "suffix": "/7", "label": "Tarama"},
                {"value": 98, "suffix": "%", "label": "Doğruluk Oranı"},
                {"value": 500, "suffix": "K+", "label": "İzlenen Fiyat"}
            ]
        },
        {
            "key": "features",
            "locale": "tr",
            "content": {
                "title": "Gelir Liderleri İçin Tasarlanmış Teknoloji",
                "subtitle": "Platform Yetenekleri",
                "items": [
                    { "icon": "chart", "title": "Fiyat İstihbaratı", "description": "Rakip otel fiyatlarını günlük olarak tarayın, geçmiş trendleri analiz edin ve fiyat değişikliklerine anında tepki verin." },
                    { "icon": "radar", "title": "Keşif Motoru", "description": "Bölgenizdeki tüm rakip otelleri harita üzerinde keşfedin. Coğrafi konum bazlı gerçek zamanlı fiyat karşılaştırması." },
                    { "icon": "share", "title": "Parite Monitörü", "description": "OTA kanallarındaki fiyat tutarsızlıklarını anında tespit edin. Marka değerinizi ve doğrudan satış kanallarınızı koruyun." },
                    { "icon": "users", "title": "Duyarlılık Analizi", "description": "AI destekli misafir yorum analizi ile rakiplerinizin zayıf noktalarını keşfedin, hizmet kalitenizi pazarın önüne taşıyın." },
                    { "icon": "bell", "title": "Anlık Uyarılar", "description": "Fiyat değişikliklerinde masaüstü bildirimleri ve e-posta uyarıları alın. Hiçbir fırsatı kaçırmayın." },
                    { "icon": "file", "title": "Akıllı Raporlar", "description": "Yapay zeka destekli pazar analiz raporları ve PDF çıktılarıyla yönetim kararlarınızı veriye dayandırın." }
                ]
            }
        },
        {
            "key": "testimonials",
            "locale": "tr",
            "content": {
                "title": "Otelciler Ne Diyor?",
                "subtitle": "Başarı Hikayeleri",
                "items": [
                    { "quote": "Hotel Plus ile gelirlerimizi %15 artırdık. Rakip analizleri sayesinde doğru fiyatı yanlış zamanda vermekten kurtulduk.", "author": "Ahmet Y.", "role": "Genel Müdür, Resort Hotel", "initials": "AY" },
                    { "quote": "Kurulumu sadece 5 dakika sürdü. Karmaşık excel tablolarından kurtulup tüm pazar verisini tek ekranda görmek harika.", "author": "Zeynep K.", "role": "Gelirler Müdürü", "initials": "ZK" },
                    { "quote": "Yatırım getirisini ilk aydan aldık. Rakiplerin fiyat hamlelerini anında görüp aksiyon alabiliyoruz.", "author": "Mehmet S.", "role": "Otel Sahibi", "initials": "MS" }
                ]
            }
        },
        {
            "key": "pricing",
            "locale": "tr",
            "content": {
                "title": "Otelinize Uygun Plan Seçin",
                "subtitle": "Fiyatlandırma",
                "plans": [
                    { "name": "Başlangıç", "price": "₺2.490", "period": "/ay", "description": "Tek otel için temel izleme", "features": ["1 otel takibi", "5 rakip izleme", "Günlük fiyat taraması", "E-posta uyarıları", "Temel raporlar"], "popular": False, "cta": "Başlayın" },
                    { "name": "Profesyonel", "price": "₺4.990", "period": "/ay", "description": "Büyüyen oteller için gelişmiş analiz", "features": ["3 otel takibi", "15 rakip izleme", "Saatlik fiyat taraması", "Push + E-posta uyarıları", "AI destekli raporlar", "Pazar analizi", "Keşif motoru"], "popular": True, "cta": "En Popüler" },
                    { "name": "Kurumsal", "price": "Özel", "period": "", "description": "Otel zincirleri için tam çözüm", "features": ["Sınırsız otel", "Sınırsız rakip", "Gerçek zamanlı tarama", "Tüm bildirim kanalları", "Global Pulse ağı", "API erişimi", "Özel entegrasyonlar", "Öncelikli destek"], "popular": False, "cta": "İletişime Geçin" }
                ]
            }
        },
        {
            "key": "faq",
            "locale": "tr",
            "content": {
                "title": "Sıkça Sorulan Sorular",
                "subtitle": "Aklınızdaki soruları yanıtlıyoruz.",
                "items": [
                    {"q": "Kurulum ne kadar sürer? Teknik bilgi gerekir mi?", "a": "Hayır, hiç teknik bilgi gerekmez. Otelinizi sisteme eklemek sadece 5 dakika sürer. Siz otel adınızı girin, gerisini yapay zekamız halleder."},
                    {"q": "Hangi sitelerden fiyat çekiyorsunuz?", "a": "Booking.com, Expedia, Hotels.com, Google Hotels ve kendi web siteleri dahil olmak üzere tüm majör OTA kanallarını ve meta arama motorlarını tarıyoruz."},
                    {"q": "Üyelik taahhüdü var mı?", "a": "Hayır, Hotel Plus'ta uzun süreli kontrat veya taahhüt yoktur. İstediğiniz zaman iptal edebilir, sadece kullandığınız kadar ödersiniz."},
                    {"q": "Kendi otelimi de takip edebilir miyim?", "a": "Kesinlikle. Kendi fiyatlarınızın rakiplerle karşılaştırmalı durumunu tek ekranda görür, parite sorunlarını anında tespit edersiniz."}
                ]
            }
        },
        {
            "key": "footer_cta",
            "locale": "tr",
            "content": {
                "title": "Fiyatlandırma Stratejinizi Bugün Güçlendirin",
                "title_highlight": "Bugün",
                "description": "Ücretsiz demo ile Hotel Plus'ı deneyimleyin. Kredi kartı gerekmez, kurulum süresi 5 dakikadır.",
                "cta_primary": "Erişim Talebi Oluşturun",
                "cta_secondary": "Zaten Hesabınız Var mı? Giriş Yapın"
            }
        }
    ]

    # Content for EN
    config_en = [
        {
            "key": "hero",
            "locale": "en",
            "content": {
                "top_label": "AI-Powered Hotel Price Intelligence",
                "title_main": "Track Your Competitors",
                "title_highlight": "Real-Time",
                "title_suffix": "Pricing",
                "description": "Don't leave your hotel's profitability to chance. Transform market data into a competitive advantage and strengthen your revenue management strategy with precise information.",
                "cta_primary": "Request Access",
                "cta_secondary": "View Membership Plans"
            }
        },
        {
            "key": "stats",
            "locale": "en",
            "content": [
                {"value": 50, "suffix": "+", "label": "Active Hotels"},
                {"value": 24, "suffix": "/7", "label": "Scanning"},
                {"value": 98, "suffix": "%", "label": "Accuracy Rate"},
                {"value": 500, "suffix": "K+", "label": "Monitored Prices"}
            ]
        },
        {
            "key": "features",
            "locale": "en",
            "content": {
                "title": "Technology Designed for Revenue Leaders",
                "subtitle": "Platform Capabilities",
                "items": [
                    { "icon": "chart", "title": "Price Intelligence", "description": "Scan competitor hotel prices daily, analyze historical trends, and react instantly to price changes." },
                    { "icon": "radar", "title": "Discovery Engine", "description": "Discover all competitor hotels in your area on a map. Real-time geo-located price comparison." },
                    { "icon": "share", "title": "Parity Monitor", "description": "Instantly detect price inconsistencies across OTA channels. Protect your brand value and direct sales channels." },
                    { "icon": "users", "title": "Sentiment Analysis", "description": "Discover your competitors' weak points with AI-powered guest review analysis, pushing your service quality ahead of the market." },
                    { "icon": "bell", "title": "Instant Alerts", "description": "Receive desktop notifications and email alerts for price changes. Never miss an opportunity." },
                    { "icon": "file", "title": "Smart Reports", "description": "Base your management decisions on data with AI-powered market analysis reports and PDF outputs." }
                ]
            }
        },
        {
            "key": "testimonials",
            "locale": "en",
            "content": {
                "title": "What Hoteliers Say?",
                "subtitle": "Success Stories",
                "items": [
                    { "quote": "We increased our revenue by 15% with Hotel Plus. Competitor analysis helped us avoid offering the right price at the wrong time.", "author": "Ahmet Y.", "role": "General Manager, Resort Hotel", "initials": "AY" },
                    { "quote": "Setup took only 5 minutes. It's great to get rid of complex excel sheets and see all market data on a single screen.", "author": "Zeynep K.", "role": "Revenue Manager", "initials": "ZK" },
                    { "quote": "We got ROI in the first month. We can instantly see competitors' price moves and take action.", "author": "Mehmet S.", "role": "Hotel Owner", "initials": "MS" }
                ]
            }
        },
        {
            "key": "pricing",
            "locale": "en",
            "content": {
                "title": "Choose the Plan That Fits Your Hotel",
                "subtitle": "Pricing",
                "plans": [
                    { "name": "Starter", "price": "₺2,490", "period": "/mo", "description": "Essential monitoring for one hotel", "features": ["1 hotel tracking", "5 competitor tracking", "Daily price scanning", "Email alerts", "Basic reports"], "popular": False, "cta": "Get Started" },
                    { "name": "Professional", "price": "₺4,990", "period": "/mo", "description": "Advanced analysis for growing hotels", "features": ["3 hotel tracking", "15 competitor tracking", "Hourly price scanning", "Push + Email alerts", "AI-powered reports", "Market analysis", "Discovery engine"], "popular": True, "cta": "Most Popular" },
                    { "name": "Enterprise", "price": "Custom", "period": "", "description": "Full solution for hotel chains", "features": ["Unlimited hotels", "Unlimited competitors", "Real-time scanning", "All notification channels", "Global Pulse network", "API access", "Custom integrations", "Priority support"], "popular": False, "cta": "Contact Us" }
                ]
            }
        },
        {
            "key": "faq",
            "locale": "en",
            "content": {
                "title": "Frequently Asked Questions",
                "subtitle": "We answer your questions.",
                "items": [
                    {"q": "How long does setup take? Do I need technical knowledge?", "a": "No, no technical knowledge is required. It takes only 5 minutes to add your hotel to the system. You enter your hotel name, our AI does the rest."},
                    {"q": "Which sites do you fetch prices from?", "a": "We scan all major OTA channels and meta-search engines, including Booking.com, Expedia, Hotels.com, Google Hotels, and their own websites."},
                    {"q": "Is there a commitment?", "a": "No, there are no long-term contracts or commitments at Hotel Plus. You can cancel at any time, only pay for what you use."},
                    {"q": "Can I track my own hotel as well?", "a": "Absolutely. You can see your own prices compared to competitors on a single screen and instantly detect parity issues."}
                ]
            }
        },
        {
            "key": "footer_cta",
            "locale": "en",
            "content": {
                "title": "Strengthen Your Pricing Strategy Today",
                "title_highlight": "Today",
                "description": "Experience Hotel Plus with a free demo. No credit card required, 5-minute setup.",
                "cta_primary": "Request Access",
                "cta_secondary": "Already have an account? Log In"
            }
        }
    ]

    print(f"--- Seeding Multi-Locale Landing Page Config ---")
    
    try:
        # Seed TR
        for entry in config_tr:
            supabase.table("landing_page_config").upsert(entry, on_conflict="key,locale").execute()
            print(f"Upserted (TR): {entry['key']}")
            
        # Seed EN
        for entry in config_en:
            supabase.table("landing_page_config").upsert(entry, on_conflict="key,locale").execute()
            print(f"Upserted (EN): {entry['key']}")
            
        print("SUCCESS: Multi-locale content seeded.")
    except Exception as e:
        print(f"FAILURE: Could not seed table. Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
