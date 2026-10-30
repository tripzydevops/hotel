"""
Unit tests for GeoGridService (Autonomous Geo-Grid Cold Start Discovery)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.geo_grid_service import (
    generate_grid_coordinates,
    sweep_google_hotels_grid,
    discover_and_seed_regional_grid,
)


class TestGeoGridMath:
    def test_single_point_grid(self):
        pts = generate_grid_coordinates(36.8841, 30.7056, radius_km=10.0, points_count=1)
        assert len(pts) == 1
        assert pts[0]["label"] == "center"
        assert pts[0]["lat"] == 36.8841
        assert pts[0]["lon"] == 30.7056

    def test_five_point_cross_grid(self):
        pts = generate_grid_coordinates(36.8841, 30.7056, radius_km=10.0, points_count=5)
        assert len(pts) == 5
        labels = {p["label"] for p in pts}
        assert labels == {"center", "north", "south", "east", "west"}
        
        # Verify north has higher latitude than center
        north = next(p for p in pts if p["label"] == "north")
        center = next(p for p in pts if p["label"] == "center")
        assert north["lat"] > center["lat"]
        assert north["lon"] == center["lon"]

    def test_nine_point_matrix_grid(self):
        pts = generate_grid_coordinates(41.0082, 28.9784, radius_km=15.0, points_count=9)
        assert len(pts) == 9
        labels = {p["label"] for p in pts}
        assert "northeast" in labels
        assert "southwest" in labels


@pytest.mark.asyncio
class TestGeoGridSweep:
    @patch("backend.services.geo_grid_service.dataforseo_provider._post_v3_request")
    async def test_sweep_deduplicates_by_identifier(self, mock_post):
        # Mock DataForSEO returning identical properties across overlapping coordinate rings
        mock_post.return_value = {
            "tasks": [
                {
                    "result": [
                        {
                            "items": [
                                {
                                    "hotel_identifier": "hotel_abc_1",
                                    "title": "Grand Alpine Resort",
                                    "stars": 5,
                                    "location": {"latitude": 36.88, "longitude": 30.70},
                                    "reviews": {"value": 4.5, "votes_count": 100},
                                    "overview_images": ["https://img.example.com/1.jpg"],
                                },
                                {
                                    "hotel_identifier": "hotel_abc_2",
                                    "title": "Boutique Lodge",
                                    "stars": 4,
                                    "location": {"latitude": 36.89, "longitude": 30.71},
                                    "reviews": {"value": 4.2, "votes_count": 50},
                                    "overview_images": [],
                                },
                            ]
                        }
                    ]
                }
            ]
        }

        hotels = await sweep_google_hotels_grid(
            center_lat=36.8841, center_lon=30.7056, radius_km=10.0, points_count=5
        )
        # Even though 5 tasks ran, the identical hotels must be deduplicated
        assert len(hotels) == 2
        ids = {h["hotel_identifier"] for h in hotels}
        assert ids == {"hotel_abc_1", "hotel_abc_2"}


@pytest.mark.asyncio
class TestColdStartWorkflow:
    @patch("backend.services.geo_grid_service.AnalystAgent")
    @patch("backend.services.geo_grid_service.get_embeddings_batch")
    @patch("backend.services.geo_grid_service.sweep_google_hotels_grid")
    async def test_discover_and_seed_regional_grid_success(
        self, mock_sweep, mock_embed, mock_analyst_cls
    ):
        mock_db = MagicMock()
        # Mock target hotel fetch
        mock_db.table().select().eq().execute.return_value.data = [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "name": "Target Hotel",
                "location": "Kars, Turkey",
                "latitude": 40.6013,
                "longitude": 43.0975,
                "serp_api_id": "target_serp_id",
            }
        ]

        # Mock sweep discovering 2 new hotels
        mock_sweep.return_value = [
            {
                "hotel_identifier": "kars_hotel_1",
                "title": "Kars Boutique Hotel",
                "stars": 4,
                "location": {"latitude": 40.602, "longitude": 43.098},
                "reviews": {"value": 4.5, "votes_count": 80},
                "overview_images": ["https://img.com/kars.jpg"],
                "prices": {"price": 1200, "currency": "TRY"},
            }
        ]

        # Mock directory check: none exist
        mock_db.table().select().in_().execute.return_value.data = []

        # Mock directory insertion
        mock_db.table().insert().execute.return_value.data = [
            {"id": "new-uuid-1", "name": "Kars Boutique Hotel"}
        ]

        # Mock batch embedding
        mock_embed.return_value = [[0.1] * 768]

        # Mock AnalystAgent discover_rivals
        mock_analyst = MagicMock()
        mock_analyst.discover_rivals = AsyncMock(
            return_value=[
                {
                    "id": "new-uuid-1",
                    "name": "Kars Boutique Hotel",
                    "similarity": 0.88,
                    "distance": 1.2,
                }
            ]
        )
        mock_analyst_cls.return_value = mock_analyst

        result = await discover_and_seed_regional_grid(
            hotel_id="11111111-1111-1111-1111-111111111111",
            radius_km=10.0,
            points_count=5,
            db=mock_db,
        )

        assert result["status"] == "success"
        assert result["newly_seeded_count"] == 1
        assert len(result["rivals"]) == 1
        assert result["rivals"][0]["name"] == "Kars Boutique Hotel"
