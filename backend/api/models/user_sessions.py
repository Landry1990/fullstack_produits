from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class UserDailySession(models.Model):
    """
    Tracks the first login and last logout of a user per day.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_sessions')
    date = models.DateField(default=timezone.now)
    first_login = models.DateTimeField(auto_now_add=True)
    last_logout = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date', '-first_login']
        verbose_name = "Session journalière"
        verbose_name_plural = "Sessions journalières"

    def __str__(self):
        return f"{self.user.username} - {self.date}"

    @property
    def duration(self):
        """Calculates the duration between first login and last logout if available."""
        if self.first_login and self.last_logout:
            return self.last_logout - self.first_login
        return None
