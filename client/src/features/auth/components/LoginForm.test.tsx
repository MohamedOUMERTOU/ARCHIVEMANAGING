import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiError } from '@/services/api/errors';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it("bloque l'envoi et explique les champs invalides", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} pending={false} error={null} />);

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'pas-un-email');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Saisissez une adresse e-mail valide.')).toBeInTheDocument();
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envoie les identifiants valides', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} pending={false} error={null} />);

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'admin@exemple.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'demo1234');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'admin@exemple.com', password: 'demo1234' },
      expect.anything(),
    );
  });

  it("affiche l'erreur renvoyée par le serveur", () => {
    const error = new ApiError({
      message: 'E-mail ou mot de passe incorrect',
      kind: 'unauthorized',
      status: 401,
    });
    render(<LoginForm onSubmit={vi.fn()} pending={false} error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect');
  });
});
