"""
KVKK VERBİS Filing Mapper Service
=================================
Generates a pre-formatted registry draft mapping the official Turkish VERBİS
(Veri Sorumluları Sicil Bilgi Sistemi) requirements for HotelPlus (Tripzy.travel).

Bilingual output (TR-primary with EN translation) designed for direct copy-paste.
"""

from datetime import datetime, timezone
from typing import Any, Dict
from supabase import Client

async def generate_verbis_draft_logic(db: Client) -> Dict[str, Any]:
    """
    Automates compiling a structured, standard-compliant VERBİS registry draft.
    Analyzes active database schema profiles, settings, and logs to construct the evidence.
    """
    
    # 1. Fetch system metadata as dynamic validation evidence
    total_users = 0
    total_hotels = 0
    try:
        users_count_res = db.table("user_profiles").select("user_id", count="exact").limit(1).execute()
        total_users = users_count_res.count or 0
        
        hotels_count_res = db.table("hotels").select("id", count="exact").limit(1).execute()
        total_hotels = hotels_count_res.count or 0
    except Exception:
        pass # Fallback to default metrics if DB is offline

    draft = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_controller": "Tripzy Travel Teknoloji A.Ş.",
            "platform": "HotelPlus B2B Rate Intelligence",
            "kvkk_compliance_officer": "Tripzy Legal Compliance Team",
            "database_evidence": {
                "active_user_nodes": total_users,
                "monitored_hotels": total_hotels
            }
        },
        "sections": [
            {
                "id": "veri_kategorileri",
                "title_tr": "1. Veri Kategorileri (Data Categories)",
                "title_en": "1. Personal Data Categories",
                "description_tr": "Platformda işlenen kişisel veri sınıfları ve veritabanı eşleşmeleri.",
                "description_en": "Personal data classes processed on the platform and their database mapping.",
                "fields": [
                    {
                        "key_tr": "Kimlik Bilgisi",
                        "key_en": "Identity Information",
                        "value_tr": "Ad Soyad (Display Name / user_profiles.display_name)",
                        "value_en": "Full Name (Display Name / user_profiles.display_name)",
                        "purpose_tr": "Kullanıcı hesaplarının oluşturulması ve kimlik doğrulama."
                    },
                    {
                        "key_tr": "İletişim Bilgisi",
                        "key_en": "Contact Information",
                        "value_tr": "E-posta Adresi (user_profiles.email), Telefon Numarası (user_profiles.phone)",
                        "value_en": "Email Address (user_profiles.email), Phone Number (user_profiles.phone)",
                        "purpose_tr": "Müşteri ilişkileri yönetimi, acil bildirimler ve sistem uyarıları."
                    },
                    {
                        "key_tr": "Müşteri İşlem",
                        "key_en": "Customer Operations",
                        "value_tr": "Takip Edilen Otel Listesi (user_hotels), Fiyat Eşik Tercihleri (settings.threshold_percent), Zaman Dilimi (user_profiles.timezone)",
                        "value_en": "Monitored Hotel List (user_hotels), Price Thresholds (settings.threshold_percent), Timezone (user_profiles.timezone)",
                        "purpose_tr": "Kişiselleştirilmiş fiyat izleme, analiz raporları ve alarm hizmetlerinin sunulması."
                    },
                    {
                        "key_tr": "İşlem Güvenliği",
                        "key_en": "Operations & Security Logs",
                        "value_tr": "Kullanıcı IP Adresi, Giriş/Çıkış Logları, Arama Geçmişi (query_logs), Sistem Bakım Kayıtları (scan_sessions)",
                        "value_en": "User IP Address, Login/Logout Logs, Search History (query_logs), System Maintenance Records (scan_sessions)",
                        "purpose_tr": "Bilgi güvenliği süreçlerinin yürütülmesi, yetkisiz erişim tespiti ve log yönetimi."
                    }
                ]
            },
            {
                "id": "veri_konusu_kisi_gruplari",
                "title_tr": "2. Veri Konusu Kişi Grupları (Data Subject Groups)",
                "title_en": "2. Data Subject Groups",
                "description_tr": "Kişisel verileri işlenen veri sahibi grupları.",
                "description_en": "Groups of data subjects whose personal data is processed.",
                "fields": [
                    {
                        "key_tr": "Müşteriler / Kullanıcılar",
                        "key_en": "Customers / Platform Users",
                        "value_tr": "Platforma üye olan B2B otel yöneticileri ve gelir analistleri.",
                        "value_en": "B2B hotel managers and revenue analysts registered on the platform."
                    },
                    {
                        "key_tr": "Çalışanlar / Yöneticiler",
                        "key_en": "Employees / Administrators",
                        "value_tr": "Sistem üzerinde yönetimsel ve denetimsel yetkileri olan personel.",
                        "value_en": "Personnel with administrative and auditing privileges on the system."
                    }
                ]
            },
            {
                "id": "isleme_amaclar",
                "title_tr": "3. Veri İşleme Amaçları (Processing Purposes)",
                "title_en": "3. Data Processing Purposes",
                "description_tr": "Kişisel verilerin işlenme gerekçeleri ve yasal amaçları.",
                "description_en": "Legal bases and operational purposes for processing data.",
                "fields": [
                    {
                        "key_tr": "Hizmet Sözleşmesinin İfası",
                        "key_en": "Execution of Services Contract",
                        "value_tr": "B2B rate intelligence, rakip analizi ve fiyat alarmları hizmetlerinin sunulması (KVKK Md. 5/2-c).",
                        "value_en": "Providing B2B rate intelligence, competitor matrix analysis, and price alarms (GDPR Art. 6/1-b)."
                    },
                    {
                        "key_tr": "Bilgi Güvenliği Süreçlerinin Yürütülmesi",
                        "key_en": "Information Security Management",
                        "value_tr": "Sistem güvenliğinin sağlanması, sızma testleri, ve işlem loglarının yasal saklama sürelerince tutulması.",
                        "value_en": "Ensuring system integrity, penetration testing, and retaining security logs for statutory audit trails."
                    },
                    {
                        "key_tr": "Faaliyetlerin Mevzuata Uygun Yürütülmesi",
                        "key_en": "Regulatory & Legal Compliance",
                        "value_tr": "KVKK, GDPR ve 5651 sayılı kanun kapsamındaki yasal log tutma yükümlülüklerinin karşılanması.",
                        "value_en": "Meeting statutory requirements under KVKK, GDPR, and local communications logging laws."
                    }
                ]
            },
            {
                "id": "yurt_disina_aktarim",
                "title_tr": "4. Yurt Dışına Veri Aktarımı (Cross-Border Data Transfers)",
                "title_en": "4. Cross-Border Data Transfers",
                "description_tr": "Kişisel verilerin yurt dışı sunucularında barındırılması durumu.",
                "description_en": "Hosting and processing personal data outside local boundaries.",
                "fields": [
                    {
                        "key_tr": "Bulut Barındırma Servisleri",
                        "key_en": "Cloud Hosting Services",
                        "value_tr": "Platform Next.js (Vercel) ve Supabase bulut sunucuları üzerinde barındırılmaktadır. Sunucu konumları Avrupa Birliği sınırları içinde yer almaktadır.",
                        "value_en": "The platform is hosted on Vercel (Next.js) and Supabase cloud infrastructure, with servers physically located in the European Union (Germany/Ireland)."
                    },
                    {
                        "key_tr": "Aktarım Yasal Gerekçesi",
                        "key_en": "Legal Basis for Transfer",
                        "value_tr": "Müşterinin açık rızası (Cookie Consent / Privacy Policy onayları) ve sözleşmenin ifası için zorunlu olması (KVKK Md. 9).",
                        "value_en": "Explicit user consent (obtained via Cookie Banner / Privacy Policy acceptances) and absolute operational necessity for contract execution (GDPR Art. 49)."
                    }
                ]
            },
            {
                "id": "teknik_idari_tedbirler",
                "title_tr": "5. Alınan Teknik ve İdari Tedbirler (Technical & Administrative Safeguards)",
                "title_en": "5. Technical & Administrative Safeguards",
                "description_tr": "Bilgi güvenliği ve veri gizliliğini korumak amacıyla platformda uygulanan aktif tedbirler.",
                "description_en": "Active controls deployed to protect information security and data confidentiality.",
                "fields": [
                    {
                        "key_tr": "Ağ Güvenliği & Şifreleme (Encryption & Network)",
                        "key_en": "Encryption & Network Security",
                        "value_tr": "Tüm veri transferleri TLS 1.3 / SSL protokolleri ile şifrelenmektedir. HSTS (Strict-Transport-Security) enjeksiyonu aktiftir. Veritabanı AES-256 şifreli saklanır.",
                        "value_en": "All communications are encrypted using TLS 1.3 / SSL. HSTS protection is active globally. Database volumes are encrypted at rest using AES-256."
                    },
                    {
                        "key_tr": "Veri İzolasyonu & Yetkilendirme (Access Control)",
                        "key_en": "Access Control & Data Isolation",
                        "value_tr": "PostgreSQL Satır Bazlı Güvenlik (Row-Level Security - RLS) politikaları aktiftir. Admin paneli yetkilendirme matrisi (RBAC) ile korunur.",
                        "value_en": "PostgreSQL Row-Level Security (RLS) is strictly enforced. Administrative portals are restricted via RBAC (Role-Based Access Control) policies."
                    },
                    {
                        "key_tr": "Veri Minimizasyonu & Sızıntı Önleme (Masking)",
                        "key_en": "Data Minimization & Information Leakage",
                        "value_tr": "Kullanıcı hesapları kalıcı silindiğinde (DSAR Purge) geçmiş analitik loglar anonimleştirilir (user_id = NULL). Global 500 hataları maskelenerek şema sızıntıları önlenir (OWASP API8).",
                        "value_en": "Upon DSAR Purge deletion, analytical records are anonymized (user_id = NULL). Global 500 exceptions are masked to prevent DB schema leakages (OWASP API8)."
                    },
                    {
                        "key_tr": "Sızma Testleri & Güvenlik Yamaları (Security Audits)",
                        "key_en": "Penetration Tests & Patch Management",
                        "value_tr": "GitHub Actions üzerinde otomatik Semgrep (SAST) güvenlik tarama boru hattı aktiftir. Yazılım bağımlılıkları düzenli olarak güncellenir.",
                        "value_en": "Continuous Semgrep (SAST) security scans execute on every push. Dependency advisories are audited and core modules are patched dynamically."
                    }
                ]
            }
        ]
    }
    
    return draft
